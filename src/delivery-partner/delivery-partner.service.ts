import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

function toNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function deliveryArea(value: any) {
  const address = value && typeof value === "object" ? value : {};
  return {
    city: address.city || null,
    state: address.state || null,
    pincode: address.pincode || null,
  };
}

@Injectable()
export class DeliveryPartnerService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private assertDeliveryPartner(actor: { id: number; role: UserRole }) {
    if (!actor || actor.role !== UserRole.DELIVERY_PARTNER) {
      throw new ForbiddenException("Delivery partner access only");
    }
  }

  private async getAssignedShopId(actorId: number) {
    const partner = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { staffShopId: true },
    });
    return partner?.staffShopId ?? null;
  }

  private orderSelect() {
    return {
      id: true,
      totalAmount: true,
      totalGst: true,
      shippingCharge: true,
      deliveryPartnerEarning: true,
      finalAmount: true,
      status: true,
      address: true,
      createdAt: true,
      acceptedAt: true,
      dispatchedAt: true,
      shippedAt: true,
      deliveredAt: true,
      deliveryPartnerName: true,
      deliveryPartnerPhone: true,
      deliveryLatitude: true,
      deliveryLongitude: true,
      deliveryLocationUpdatedAt: true,
      deliveryOtpVerifiedAt: true,
      deliveryMode: true,
      scheduledDeliveryAt: true,
      deliverySlotLabel: true,
      user: { select: { id: true, name: true, phone: true, email: true } },
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
      dispatchedBy: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          staffShop: {
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
      },
      deliveryPartner: { select: { id: true, name: true, phone: true, email: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          originalPrice: true,
          variantName: true,
          flavour: true,
          weightLabel: true,
          product: { select: { id: true, title: true, img1: true } },
          variant: { select: { id: true, name: true, flavour: true, weightLabel: true, image1: true } },
          size: { select: { size: true } },
        },
      },
    };
  }

  async getReadyOrders(actor: { id: number; role: UserRole }) {
    this.assertDeliveryPartner(actor);
    const shopId = await this.getAssignedShopId(actor.id);
    if (!shopId) return [];

    const orders = await this.prisma.order.findMany({
      where: {
        shopId,
        status: OrderStatus.SHIPPED,
        deliveryPartnerId: null,
        OR: [
          { deliveryMode: { not: "SCHEDULED" } },
          { scheduledDeliveryAt: null },
          { scheduledDeliveryAt: { lte: new Date() } },
        ],
      },
      select: this.orderSelect(),
      orderBy: { dispatchedAt: "asc" },
    });
    // Before acceptance, expose only the delivery area—not the customer's
    // exact street, phone, name, or coordinates.
    return orders.map((order) => ({
      ...order,
      address: deliveryArea(order.address),
      user: { id: order.user.id },
    }));
  }

  async getMyOrders(actor: { id: number; role: UserRole }) {
    this.assertDeliveryPartner(actor);

    const orders = await this.prisma.order.findMany({
      where: { deliveryPartnerId: actor.id },
      select: this.orderSelect(),
      orderBy: { createdAt: "desc" },
    });
    return orders.map((order) => order.status === OrderStatus.SHIPPED
      ? { ...order, shop: null, dispatchedBy: null }
      : {
          ...order,
          shop: null,
          dispatchedBy: null,
          address: deliveryArea(order.address),
          deliveryLatitude: null,
          deliveryLongitude: null,
        },
    );
  }

  async acceptOrder(orderId: number, actor: { id: number; role: UserRole }) {
    this.assertDeliveryPartner(actor);

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    const shopId = await this.getAssignedShopId(actor.id);
    if (!shopId || order.shopId !== shopId) {
      throw new ForbiddenException("You can accept only deliveries from your assigned shop");
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException("Order is not ready for delivery pickup");
    }
    if (order.deliveryPartnerId && order.deliveryPartnerId !== actor.id) {
      throw new BadRequestException("Order is already assigned to another delivery partner");
    }

    if (!order.deliveryPartnerId) {
      const claimed = await this.prisma.order.updateMany({
        where: { id: orderId, status: OrderStatus.SHIPPED, deliveryPartnerId: null },
        data: { deliveryPartnerId: actor.id },
      });
      if (!claimed.count) throw new ConflictException("This delivery was accepted by another partner");
    }

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: this.orderSelect(),
    });
    this.notifications.createAndSend({
      userId: updated.user.id,
      type: "DELIVERY_ACCEPTED",
      title: "Delivery partner assigned",
      body: `${updated.deliveryPartner?.name || "Your delivery partner"} accepted order #${updated.id}.`,
      data: { orderId: updated.id, screen: "OrderTracking" },
    }).catch(() => undefined);
    return { ...updated, shop: null, dispatchedBy: null };
  }

  async updateLocation(
    orderId: number,
    actor: { id: number; role: UserRole },
    body: {
      latitude: number;
      longitude: number;
      deliveryPartnerName?: string;
      deliveryPartnerPhone?: string;
    },
  ) {
    this.assertDeliveryPartner(actor);

    const latitude = toNumber(body.latitude);
    const longitude = toNumber(body.longitude);
    if (
      latitude === null ||
      longitude === null ||
      latitude < 6 ||
      latitude > 38 ||
      longitude < 68 ||
      longitude > 98
    ) {
      throw new BadRequestException("Valid latitude and longitude are required");
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.deliveryPartnerId !== actor.id) {
      throw new ForbiddenException("You can update only your assigned deliveries");
    }

    const updated = await this.prisma.order.update({
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
      select: this.orderSelect(),
    });
    return { ...updated, shop: null, dispatchedBy: null };
  }

  async markDelivered(orderId: number, actor: { id: number; role: UserRole }, otpValue?: string) {
    this.assertDeliveryPartner(actor);

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.deliveryPartnerId !== actor.id) {
      throw new ForbiddenException("You can deliver only your assigned orders");
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException("Only dispatched orders can be marked delivered");
    }
    const otp = String(otpValue || "").trim();
    if (!/^\d{4}$/.test(otp)) {
      throw new BadRequestException("Enter the 4-digit customer delivery OTP");
    }
    if (!order.deliveryOtp || otp !== order.deliveryOtp) {
      throw new BadRequestException("Invalid delivery OTP");
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
        deliveryOtpVerifiedAt: new Date(),
      },
      select: this.orderSelect(),
    });
    this.notifications.notifyOrderStatus({
      id: updated.id,
      userId: updated.user.id,
      status: OrderStatus.DELIVERED,
    }).catch(() => undefined);
    return {
      ...updated,
      shop: null,
      dispatchedBy: null,
      address: deliveryArea(updated.address),
      deliveryLatitude: null,
      deliveryLongitude: null,
    };
  }
}
