import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
} from "@nestjs/common";
import { DelhiveryService } from "./delhivery.service";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("admin/shipping")
@UseGuards(JwtAuthGuard, AdminGuard)
export class DelhiveryAdminController {
  constructor(
    private delhiveryService: DelhiveryService,
    private prisma: PrismaService
  ) {}

  @Post("delhivery/:orderId")
  shipWithDelhivery(
    @Param("orderId", ParseIntPipe) orderId: number
  ) {
    return this.delhiveryService.createShipment(orderId);
  }
 @Get("track/:orderId")
async trackOrder(@Param("orderId", ParseIntPipe) orderId: number) {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order || !order.trackingId) {
    throw new NotFoundException(
      "Order not shipped yet. Tracking unavailable."
    );
  }

  return this.delhiveryService.trackShipment(order.trackingId);
}
}
@Controller("delivery")
export class DeliveryPublicController {
  constructor(private readonly delhiveryService: DelhiveryService) {}

  @Post("check-pincode")
  checkPincode(@Body("pincode") pincode: string) {
    return this.delhiveryService.checkPincode(pincode);
  }
}
