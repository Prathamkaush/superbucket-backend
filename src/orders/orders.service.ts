import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma , OrderStatus } from "@prisma/client";
import { getDelhiveryRate } from "../delivery/delhivery-rates.service";
import { CouponsService } from "../coupons/coupons.service";

function calculateOrderWeightKg(items: any[]) {
  return items.reduce((sum, item) => {
    return sum + Number(item.variant?.weightKg ?? item.product.weight) * item.quantity;
  }, 0);
}

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService ,  private couponsService: CouponsService ) {}

  // ================= ADMIN =================

  async getAll(query: any) {
    const { page = 1, limit = 10, status, minAmount, maxAmount } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

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

  async getOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { user: true, items: { include: { product: true, variant: true, size: true } } },
    });

    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  // ================= ADMIN STATUS UPDATE =================
 async updateStatus(orderId: number, status: OrderStatus) {
  const data: any = { status };

  if (status === OrderStatus.CONFIRMED) {
    data.confirmedAt = new Date();
  }

  if (status === OrderStatus.SHIPPED) {
    data.shippedAt = new Date();
  }

  if (status === OrderStatus.DELIVERED) {
    data.deliveredAt = new Date();
  }

  return this.prisma.order.update({
    where: { id: orderId },
    data,
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
    };
  }

  if (!address || !address.pincode) {
    throw new BadRequestException("Address is required");
  }

  return address;
}

  // ================= CREATE ORDER (COD / RAZORPAY) =================
async createOrder(
  userId: number,
  payload: {
    address?: any;
    addressId?: number;
    paymentMethod: "COD" | "RAZORPAY";
    couponCode?: string;
  }
) {
  const { paymentMethod, couponCode } = payload;

  // 🔑 Resolve address FIRST
  const address = await this.resolveAddress(
    userId,
    payload.address,
    payload.addressId
  );

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
        status: OrderStatus.PENDING,

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

  return {
    orderId: order.id,
    itemsTotal,
    gstTotal,
    shippingCharge,
    couponDiscount,
    finalAmount: payable,
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

  // ✅ Transaction-safe cart rebuild
  await this.prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({
      where: { userId },
    });

    await tx.cartItem.createMany({
      data: order.items.map((i) => ({
        userId,
        productId: i.productId,
        variantId: i.variantId ?? null,
        sizeId: i.sizeId ?? null,
        quantity: i.quantity,
        price: Number(i.price),
        gstRate: Number(i.gstRate || 0),
        gstAmount: Number(i.gstAmount || 0),
      })),
    });
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
  paymentMethod: "COD" | "RAZORPAY",
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
