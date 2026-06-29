import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

function toNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

@Injectable()
export class DeliveryPartnerService {
  constructor(private prisma: PrismaService) {}

  private assertDeliveryPartner(actor: { id: number; role: UserRole }) {
    if (!actor || actor.role !== UserRole.DELIVERY_PARTNER) {
      throw new ForbiddenException("Delivery partner access only");
    }
  }

  private orderInclude() {
    return {
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
      dispatchedBy: { select: { id: true, name: true, phone: true, email: true } },
      deliveryPartner: { select: { id: true, name: true, phone: true, email: true } },
      deliveryOtp: true,
      deliveryOtpVerifiedAt: true,
      items: {
        include: {
          product: { select: { id: true, title: true, img1: true } },
          variant: { select: { id: true, name: true, flavour: true, weightLabel: true, image1: true } },
          size: { select: { size: true } },
        },
      },
    };
  }

  async getReadyOrders(actor: { id: number; role: UserRole }) {
    this.assertDeliveryPartner(actor);

    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.SHIPPED,
        deliveryPartnerId: null,
        OR: [
          { deliveryMode: { not: "SCHEDULED" } },
          { scheduledDeliveryAt: null },
          { scheduledDeliveryAt: { lte: new Date() } },
        ],
      },
      include: this.orderInclude(),
      orderBy: { dispatchedAt: "asc" },
    });
  }

  async getMyOrders(actor: { id: number; role: UserRole }) {
    this.assertDeliveryPartner(actor);

    return this.prisma.order.findMany({
      where: { deliveryPartnerId: actor.id },
      include: this.orderInclude(),
      orderBy: { createdAt: "desc" },
    });
  }

  async acceptOrder(orderId: number, actor: { id: number; role: UserRole }) {
    this.assertDeliveryPartner(actor);

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException("Order is not ready for delivery pickup");
    }
    if (order.deliveryPartnerId && order.deliveryPartnerId !== actor.id) {
      throw new BadRequestException("Order is already assigned to another delivery partner");
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { deliveryPartnerId: actor.id },
      include: this.orderInclude(),
    });
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
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException("Valid latitude and longitude are required");
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.deliveryPartnerId !== actor.id) {
      throw new ForbiddenException("You can update only your assigned deliveries");
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
      include: this.orderInclude(),
    });
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

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
        deliveryOtpVerifiedAt: new Date(),
      },
      include: this.orderInclude(),
    });
  }
}
