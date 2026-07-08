import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma , OrderStatus, UserRole, WalletTransactionType } from "@prisma/client";
import { getDelhiveryRate } from "../delivery/delhivery-rates.service";
import { CouponsService } from "../coupons/coupons.service";
import { NotificationsService } from "../notifications/notifications.service";
import { randomInt } from "crypto";

function calculateOrderWeightKg(items: any[]) {
  return items.reduce((sum, item) => {
    return sum + Number(item.variant?.weightKg ?? item.product.weight) * item.quantity;
  }, 0);
}

function toNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusKm = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService,
    private notifications: NotificationsService,
  ) {}

  // ================= ADMIN =================

  private async getActorShopScope(actor?: { id: number; role: UserRole }) {
    if (!actor || actor.role === UserRole.ADMIN) return undefined;

    if (actor.role === UserRole.SUB_ADMIN) {
      const shop = await this.prisma.shop.findFirst({
        where: { ownerId: actor.id },
        select: { id: true },
      });
      return shop?.id ?? -1;
    }

    if (actor.role === UserRole.PICKER) {
      const picker = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: { staffShopId: true },
      });
      return picker?.staffShopId ?? undefined;
    }

    return -1;
  }

  private async findNearestShop(address: any) {
    const pincode = String(address?.pincode || "").trim();
    const userLat = toNumber(address?.latitude ?? address?.lat);
    const userLng = toNumber(address?.longitude ?? address?.lng);

    const shops = await this.prisma.shop.findMany({
      where: {
        isActive: true,
        OR: [
          ...(pincode ? [{ pincode }] : []),
          ...(pincode.length >= 3 ? [{ pincode: { startsWith: pincode.slice(0, 3) } }] : []),
          ...(userLat !== null && userLng !== null
            ? [{ latitude: { not: null }, longitude: { not: null } }]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        pincode: true,
        latitude: true,
        longitude: true,
        radiusKm: true,
      },
    });

    if (!shops.length) return null;

    if (userLat !== null && userLng !== null) {
      const nearby = shops
        .map((shop) => {
          const shopLat = toNumber(shop.latitude);
          const shopLng = toNumber(shop.longitude);
          if (shopLat === null || shopLng === null) return null;
          return {
            ...shop,
            distanceKm: haversineKm(userLat, userLng, shopLat, shopLng),
          };
        })
        .filter((shop): shop is NonNullable<typeof shop> => Boolean(shop))
        .filter((shop) => shop.distanceKm <= shop.radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      if (nearby.length) return nearby[0];
    }

    const exactPincode = shops.find((shop) => shop.pincode === pincode);
    return exactPincode ?? shops[0];
  }

  async getAll(query: any, actor?: { id: number; role: UserRole }) {
    const { page = 1, limit = 10, status, minAmount, maxAmount, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    const shopId = await this.getActorShopScope(actor);
    if (actor?.role === UserRole.PICKER && shopId !== undefined) {
      where.OR = [{ shopId }, { shopId: null }];
    } else if (shopId !== undefined) {
      where.shopId = shopId;
    }
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    if (minAmount || maxAmount) {
      where.finalAmount = {};
      if (minAmount) where.finalAmount.gte = Number(minAmount);
      if (maxAmount) where.finalAmount.lte = Number(maxAmount);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: true,
          acceptedBy: { select: { id: true, name: true, email: true } },
          dispatchedBy: { select: { id: true, name: true, email: true } },
          fulfilledBy: { select: { id: true, name: true, email: true } },
          shop: { select: { id: true, name: true, pincode: true } },
          items: { include: { product: true, variant: true, size: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      total,
      pages: Math.ceil(total / limit),
      page: Number(page),
    };
  }

  async getOne(id: number, actor?: { id: number; role: UserRole }) {
    const shopId = await this.getActorShopScope(actor);
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        acceptedBy: { select: { id: true, name: true, email: true } },
        dispatchedBy: { select: { id: true, name: true, email: true } },
        fulfilledBy: { select: { id: true, name: true, email: true } },
        shop: { select: { id: true, name: true, pincode: true, ownerId: true } },
        items: { include: { product: true, variant: true, size: true } },
      },
    });

    if (!order) throw new NotFoundException("Order not found");
    if (
      shopId !== undefined &&
      order.shopId !== shopId &&
      !(actor?.role === UserRole.PICKER && order.shopId === null)
    ) {
      throw new ForbiddenException("You can access only your shop orders");
    }
    return order;
  }

  // ================= ADMIN STATUS UPDATE =================
 async updateStatus(orderId: number, status: OrderStatus, actor?: { id: number; role: UserRole }) {
  const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new NotFoundException("Order not found");
  const shopId = await this.getActorShopScope(actor);
  if (
    shopId !== undefined &&
    existing.shopId !== shopId &&
    !(actor?.role === UserRole.PICKER && existing.shopId === null)
  ) {
    throw new ForbiddenException("You can update only your shop orders");
  }

  if (actor?.role === UserRole.PICKER) {
    if (
      status === OrderStatus.SHIPPED &&
      existing.deliveryMode === "SCHEDULED" &&
      existing.scheduledDeliveryAt &&
      existing.scheduledDeliveryAt.getTime() > Date.now()
    ) {
      throw new ForbiddenException("Scheduled orders can be dispatched only at the selected delivery slot");
    }

    const allowed =
      (existing.status === OrderStatus.PENDING && status === OrderStatus.CONFIRMED) ||
      (existing.status === OrderStatus.CONFIRMED && status === OrderStatus.SHIPPED);

    if (!allowed) {
      throw new ForbiddenException("Picker can only accept, dispatch, and fulfill orders in sequence");
    }

    if (
      existing.acceptedById &&
      existing.acceptedById !== actor.id &&
      status === OrderStatus.SHIPPED
    ) {
      throw new ForbiddenException("Only the picker who accepted this order can dispatch or fulfill it");
    }
  }

  const data: any = { status };

  if (status === OrderStatus.CONFIRMED) {
    data.confirmedAt = new Date();
    data.acceptedAt = new Date();
    if (actor?.id) data.acceptedById = actor.id;
    if (actor?.role === UserRole.PICKER && existing.shopId === null && shopId !== undefined) {
      data.shopId = shopId;
    }
  }

  if (status === OrderStatus.SHIPPED) {
    data.shippedAt = new Date();
    data.dispatchedAt = new Date();
    if (actor?.id) data.dispatchedById = actor.id;
    if (actor?.role === UserRole.PICKER && existing.shopId === null && shopId !== undefined) {
      data.shopId = shopId;
    } else if (existing.shopId === null) {
      const nearestShop = await this.findNearestShop(existing.address);
      if (nearestShop?.id) data.shopId = nearestShop.id;
    }
  }

  if (status === OrderStatus.DELIVERED) {
    data.deliveredAt = new Date();
    data.fulfilledAt = new Date();
    if (actor?.id) data.fulfilledById = actor.id;
  }

  const updated = await this.prisma.order.update({
    where: { id: orderId },
    data,
    include: {
      acceptedBy: { select: { id: true, name: true, email: true } },
      dispatchedBy: { select: { id: true, name: true, email: true } },
      fulfilledBy: { select: { id: true, name: true, email: true } },
      shop: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  this.notifications.notifyOrderStatus(updated).catch(() => undefined);
  return updated;
}

async updateDeliveryLocation(
  orderId: number,
  actor: { id: number; role: UserRole },
  body: {
    latitude: number;
    longitude: number;
    deliveryPartnerName?: string;
    deliveryPartnerPhone?: string;
  }
) {
  const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new NotFoundException("Order not found");

  const shopId = await this.getActorShopScope(actor);
  if (shopId !== undefined && existing.shopId !== shopId) {
    throw new ForbiddenException("You can update only your shop orders");
  }

  const latitude = toNumber(body.latitude);
  const longitude = toNumber(body.longitude);

  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new BadRequestException("Valid latitude and longitude are required");
  }

  return this.prisma.order.update({
    where: { id: orderId },
    data: {
      deliveryLatitude: latitude,
      deliveryLongitude: longitude,
      deliveryLocationUpdatedAt: new Date(),
      ...(body.deliveryPartnerName !== undefined && {
        deliveryPartnerName: String(body.deliveryPartnerName || "").trim() || null,
      }),
      ...(body.deliveryPartnerPhone !== undefined && {
        deliveryPartnerPhone: String(body.deliveryPartnerPhone || "").trim() || null,
      }),
    },
    select: {
      id: true,
      status: true,
      deliveryPartnerName: true,
      deliveryPartnerPhone: true,
      deliveryLatitude: true,
      deliveryLongitude: true,
      deliveryLocationUpdatedAt: true,
    },
  });
}
async resolveAddress(
  userId: number,
  address?: any,
  addressId?: number
) {
  if (addressId) {
    const saved = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!saved) {
      throw new BadRequestException("Address not found");
    }

      return {
        name: saved.name,
        phone: saved.phone,
        street: saved.street,
        city: saved.city,
        state: saved.state,
        pincode: saved.pincode,
        latitude: toNumber(saved.latitude),
        longitude: toNumber(saved.longitude),
      };
    }

  if (!address || !address.pincode) {
    throw new BadRequestException("Address is required");
  }

  return address;
}

  // ================= CREATE ORDER (COD / RAZORPAY / WALLET) =================
async createOrder(
  userId: number,
  payload: {
    address?: any;
    addressId?: number;
    paymentMethod: "COD" | "RAZORPAY" | "WALLET";
    couponCode?: string;
    deliveryMode?: "INSTANT" | "SCHEDULED";
    scheduledDeliveryAt?: string | Date;
    deliverySlotLabel?: string;
  }
) {
  const { paymentMethod, couponCode } = payload;
  const deliveryMode = payload.deliveryMode === "SCHEDULED" ? "SCHEDULED" : "INSTANT";
  const scheduledDeliveryAt =
    deliveryMode === "SCHEDULED" && payload.scheduledDeliveryAt
      ? new Date(payload.scheduledDeliveryAt)
      : null;

  if (
    deliveryMode === "SCHEDULED" &&
    (!scheduledDeliveryAt || Number.isNaN(scheduledDeliveryAt.getTime()))
  ) {
    throw new BadRequestException("Valid scheduled delivery slot is required");
  }

  const deliverySlotLabel =
    deliveryMode === "SCHEDULED"
      ? String(payload.deliverySlotLabel || "").trim() ||
        scheduledDeliveryAt?.toLocaleString("en-IN")
      : "Instant delivery";

  // 🔑 Resolve address FIRST
  const address = await this.resolveAddress(
    userId,
    payload.address,
    payload.addressId
  );
  const assignedShop = await this.findNearestShop(address);

  const cart = await this.prisma.cartItem.findMany({
    where: { userId },
    include: { product: true, variant: true, size: true },
  });

  if (!cart.length) {
    throw new BadRequestException("Cart is empty");
  }

  for (const item of cart) {
    if (Number(item.price) <= 0) {
      throw new BadRequestException(
        `${item.product.title} has invalid price`
      );
    }

    if (!(item.variant?.weightKg ?? item.product.weight) || Number(item.variant?.weightKg ?? item.product.weight) <= 0) {
      throw new BadRequestException(
        `${item.product.title} has invalid weight`
      );
    }
  }

  const itemsTotal = cart.reduce(
    (sum, i) => sum + Number(i.price) * i.quantity,
    0
  );
  const gstTotal = cart.reduce(
    (sum, i) => sum + Number(i.gstAmount || 0) * i.quantity,
    0
  );
  const itemsTotalWithGst = itemsTotal + gstTotal;

  const totalWeightKg = calculateOrderWeightKg(cart);
  const chargeableWeight = Math.max(totalWeightKg, 0.5);

  /* ================= SHIPPING ================= */
  let shippingCharge = 0;

  if (itemsTotalWithGst < 2999) {
    try {
      shippingCharge = await getDelhiveryRate({
        pickupPin: process.env.DELHIVERY_PICKUP_PIN!,
        deliveryPin: String(address.pincode),
        weightKg: chargeableWeight,
        cod: paymentMethod === "COD",
        codAmount: paymentMethod === "COD" ? itemsTotalWithGst : 0,
      });
    } catch {
      throw new BadRequestException(
        "Unable to calculate shipping for this address"
      );
    }
  }

  const subtotal = itemsTotalWithGst + shippingCharge;

  /* ================= COUPON ================= */
  let couponDiscount = 0;
  let couponCodeApplied: string | null = null;

  if (couponCode) {
    const result = await this.couponsService.validateCoupon({
  code: couponCode,
  orderAmount: subtotal,
  userId: userId,
});

    if (!result.valid) {
      throw new BadRequestException(result.message);
    }

    couponDiscount = result.discount;
    couponCodeApplied = couponCode.toUpperCase();
  }

  const payable = Math.max(0, subtotal - couponDiscount);
  const deliveryOtp = randomInt(1000, 10000).toString();

  /* ================= TRANSACTION ================= */
  const order = await this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId,
        paymentMethod,
        paidAt: paymentMethod === "COD" ? null : new Date(),
        totalAmount: itemsTotal,
        totalGst: gstTotal,
        shippingCharge,
        couponCode: couponCodeApplied,
        couponDiscount,
        finalAmount: payable,
        totalWeight: chargeableWeight,
        deliveryOtp,
        deliveryOtpVerifiedAt: null,
        deliveryMode,
        scheduledDeliveryAt,
        deliverySlotLabel,
        status: OrderStatus.PENDING,
        shopId: assignedShop?.id ?? null,

        // ✅ SNAPSHOT address (Amazon-style)
        address,

        items: {
          create: cart.map((i) => ({
            productId: i.productId,
            variantId: i.variantId ?? null,
            sizeId: i.sizeId ?? null,
            quantity: i.quantity,
            price: Number(i.price),
            originalPrice: Number(i.product.price),
            discountType: i.product.discountType,
            discountValue: i.product.discountValue,
            gstRate: Number(i.gstRate || 0),
            gstAmount: Number(i.gstAmount || 0),
            variantName: i.variant?.name ?? null,
            variantAttributes: i.variant?.attributes ?? undefined,
            flavour: i.variant?.flavour ?? null,
            weightLabel: i.variant?.weightLabel ?? null,
            sku: i.variant?.sku ?? null,
          })),
        },
      },
    });

    if (paymentMethod === "WALLET") {
      const wallet = await tx.walletAccount.findUnique({ where: { userId } });
      if (!wallet || Number(wallet.balance) < payable) {
        throw new BadRequestException("Insufficient wallet balance");
      }

      await tx.walletAccount.update({
        where: { userId },
        data: { balance: { decrement: payable } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: WalletTransactionType.DEBIT,
          amount: payable,
          label: `Order #${order.id} payment`,
          reference: `order_${order.id}`,
        },
      });
    }

    /* STOCK UPDATE */
    for (const item of cart) {
      if (item.variantId) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (!updated.count) {
          throw new BadRequestException(
            `${item.product.title} (${item.variant?.name || item.variant?.flavour || item.variant?.weightLabel || "variant"}) is out of stock`
          );
        }
      } else if (item.sizeId) {
        const updated = await tx.productSize.updateMany({
          where: { id: item.sizeId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (!updated.count) {
          throw new BadRequestException(
            `${item.product.title} (${item.size?.size}) is out of stock`
          );
        }
      } else {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (!updated.count) {
          throw new BadRequestException(
            `${item.product.title} is out of stock`
          );
        }
      }
    }

    if (couponCodeApplied && couponCodeApplied !== "FIRSTFEMALE") {
      await tx.coupon.update({
        where: { code: couponCodeApplied },
        data: { usedCount: { increment: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { userId } });

    return order;
  });

  this.notifications.notifyOrderCreated(userId, order).catch(() => undefined);

  return {
    orderId: order.id,
    shop: assignedShop
      ? {
          id: assignedShop.id,
          name: assignedShop.name,
          pincode: assignedShop.pincode,
          distanceKm: "distanceKm" in assignedShop ? assignedShop.distanceKm : null,
        }
      : null,
    itemsTotal,
    gstTotal,
    shippingCharge,
    couponDiscount,
    finalAmount: payable,
    deliveryOtp,
    deliveryMode,
    scheduledDeliveryAt,
    deliverySlotLabel,
  };
}

  // ================= USER =================

async getMyOrders(userId: number, page = 1, limit = 5) {
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    this.prisma.order.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,

        paymentMethod: true,

        totalAmount: true,        // 🧾 items subtotal
        totalGst: true,
        shippingCharge: true,     // 🚚 shipping
        couponCode: true,         // 🎟️ ADD THIS
        couponDiscount: true,     // 🎟️ ADD THIS
        finalAmount: true,        // 💳 final payable

        courier: true,
        trackingId: true,
        deliveryPartnerName: true,
        deliveryPartnerPhone: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        deliveryLocationUpdatedAt: true,
        deliveryOtp: true,
        deliveryOtpVerifiedAt: true,
        deliveryMode: true,
        scheduledDeliveryAt: true,
        deliverySlotLabel: true,
        shop: {
          select: {
            id: true,
            name: true,
            pincode: true,
          },
        },

        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            gstRate: true,
            gstAmount: true,
          product: {
            select: {
              id: true,
              title: true,
              img1: true,
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              attributes: true,
              flavour: true,
              weightLabel: true,
              image1: true,
            },
          },
          size: {
              select: {
                size: true,
              },
            },
          },
        },
      },
    }),

    this.prisma.order.count({ where: { userId } }),
  ]);

  return {
  orders: orders.map(o => ({
    ...o,
    pricing: {
      itemsSubtotal: o.totalAmount,
      gst: o.totalGst,
      shipping: o.shippingCharge,
      couponDiscount: o.couponDiscount ?? 0,
      payable: o.finalAmount,
    },
  })),
  page,
  pages: Math.ceil(total / limit),
  total,
};
}

async getMyOrderById(orderId: number, userId: number) {
  const order = await this.prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      status: true,
      createdAt: true,

      confirmedAt: true,

      paymentMethod: true,
      paidAt: true,

      totalAmount: true,        // 🧾 items subtotal
      totalGst: true,
      shippingCharge: true,     // 🚚 shipping
      couponCode: true,         // 🎟️ ADD THIS
      couponDiscount: true,     // 🎟️ ADD THIS
      finalAmount: true,        // 💳 final paid
      totalWeight: true,

      courier: true,
      trackingId: true,
      shippedAt: true,
      deliveredAt: true,
      deliveryPartnerName: true,
      deliveryPartnerPhone: true,
      deliveryLatitude: true,
      deliveryLongitude: true,
      deliveryLocationUpdatedAt: true,
      deliveryOtp: true,
      deliveryOtpVerifiedAt: true,
      deliveryMode: true,
      scheduledDeliveryAt: true,
      deliverySlotLabel: true,
      shop: {
        select: {
          id: true,
          name: true,
          pincode: true,
          latitude: true,
          longitude: true,
        },
      },

      address: true,

      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          originalPrice: true,
          discountType: true,
          discountValue: true,
          gstRate: true,
          gstAmount: true,
          product: {
            select: {
              id: true,
              title: true,
              img1: true,
              weight: true,
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              flavour: true,
              weightLabel: true,
              weightKg: true,
              image1: true,
            },
          },
          size: {
            select: {
              size: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  return {
  ...order,
  pricing: {
    itemsSubtotal: order.totalAmount,
    gst: order.totalGst,
    shipping: order.shippingCharge,
    couponDiscount: order.couponDiscount ?? 0,
    payable: order.finalAmount,
  },
};
}

  // ================= CANCEL =================
async cancelOrder(orderId: number, userId: number) {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  if (order.userId !== userId) {
    throw new BadRequestException("Unauthorized");
  }

  if (order.status === OrderStatus.CANCELLED) {
    throw new BadRequestException("Order already cancelled");
  }

  // ✅ Only PENDING orders are cancellable
  if (order.status !== OrderStatus.PENDING) {
    throw new BadRequestException(
      "Order cannot be cancelled after confirmation"
    );
  }

  await this.prisma.$transaction(async (tx) => {
    // Restore stock
    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      } else if (item.sizeId) {
        await tx.productSize.update({
          where: { id: item.sizeId },
          data: { stock: { increment: item.quantity } },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    // Update order status
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });
  });

  return {
    success: true,
    message: "Order cancelled successfully",
  };
}

  // ================= REORDER =================
async reorder(orderId: number, userId: number) {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
          size: true,
        },
      },
    },
  });

  if (!order || order.userId !== userId) {
    throw new NotFoundException("Order not found");
  }

  // ✅ Business rule
  if (
    !["DELIVERED", "CANCELLED"].includes(order.status)
  ) {
    throw new BadRequestException(
      "Reorder is allowed only for completed or cancelled orders"
    );
  }

  // ✅ Stock validation
  for (const item of order.items) {
    if (item.variantId) {
      if (!item.variant || item.variant.stock < item.quantity) {
        throw new BadRequestException(
          `${item.product.title} (${item.variantName || item.flavour || item.weightLabel || "variant"}) is out of stock`
        );
      }
    } else if (item.sizeId) {
      if (!item.size || item.size.stock < item.quantity) {
        throw new BadRequestException(
          `${item.product.title} (${item.size?.size}) is out of stock`
        );
      }
    } else {
      if (!item.product || item.product.stock < item.quantity) {
        throw new BadRequestException(
          `${item.product.title} is out of stock`
        );
      }
    }
  }

  // Add previous order items into the current cart without removing existing items.
  await this.prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const existing = await tx.cartItem.findFirst({
        where: {
          userId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          sizeId: item.sizeId ?? null,
        },
      });
      const availableStock = item.variantId
        ? item.variant?.stock || 0
        : item.sizeId
        ? item.size?.stock || 0
        : item.product?.stock || 0;
      const nextQuantity = (existing?.quantity || 0) + item.quantity;

      if (nextQuantity > availableStock) {
        throw new BadRequestException(
          `${item.product.title} does not have enough stock`
        );
      }

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: nextQuantity,
            price: Number(item.price),
            gstRate: Number(item.gstRate || 0),
            gstAmount: Number(item.gstAmount || 0),
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            userId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            sizeId: item.sizeId ?? null,
            quantity: item.quantity,
            price: Number(item.price),
            gstRate: Number(item.gstRate || 0),
            gstAmount: Number(item.gstAmount || 0),
            weight: Number(item.variant?.weightKg ?? item.product?.weight ?? 0),
          },
        });
      }
    }
  });

  return {
    success: true,
    message: "Items added to cart successfully",
  };
}
async previewOrder(
  userId: number,
  payload: {
    address?: any;
    addressId?: number;
  },
  paymentMethod: "COD" | "RAZORPAY" | "WALLET",
  couponCode?: string
) {
  let address: any;

  if (payload.addressId) {
    address = await this.prisma.userAddress.findFirst({
      where: {
        id: payload.addressId,
        userId,
      },
    });

    if (!address) {
      throw new BadRequestException("Invalid address selected");
    }
  } else if (payload.address) {
    address = payload.address;
  } else {
    throw new BadRequestException("Address is required");
  }
  const cartItems = await this.prisma.cartItem.findMany({
    where: { userId },
    include: { product: true, variant: true, size: true },
  });

  if (!cartItems.length) {
    throw new BadRequestException("Cart is empty");
  }

  const itemsTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );
  const gstTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.gstAmount || 0) * item.quantity,
    0
  );
  const itemsTotalWithGst = itemsTotal + gstTotal;

  const weightKg = Math.max(
    cartItems.reduce(
      (sum, item) =>
        sum + Number(item.variant?.weightKg ?? item.product.weight ?? 0) * item.quantity,
      0
    ),
    0.5
  );

  let shippingCharge = 0;

  if (itemsTotalWithGst < 2999) {
    try {
      shippingCharge = await getDelhiveryRate({
        pickupPin: process.env.DELHIVERY_PICKUP_PIN!,
        deliveryPin: String(address.pincode),
        weightKg,
        cod: paymentMethod === "COD",
        codAmount: paymentMethod === "COD" ? itemsTotalWithGst : 0,
      });
    } catch {
      shippingCharge = 100;
    }
  }

  const subtotal = itemsTotalWithGst + shippingCharge;

  let couponDiscount = 0;
  let appliedCoupon: string | null = null;

  if (couponCode) {
    const result = await this.couponsService.validateCoupon({
  code: couponCode,
  orderAmount: subtotal,
  userId: userId,
});

    if (!result.valid) {
      throw new BadRequestException(result.message);
    }

    couponDiscount = result.discount;
    appliedCoupon = couponCode.toUpperCase();
  }

  const finalAmount = Math.max(0, subtotal - couponDiscount);

  return {
    addressPreview: {
      name: address.name,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    },
    pricing: {
      itemsSubtotal: itemsTotal,
      gst: gstTotal,
      shipping: shippingCharge,
      couponDiscount,
      payable: finalAmount,
    },
    appliedCoupon,
    weightKg,
  };
}

}
