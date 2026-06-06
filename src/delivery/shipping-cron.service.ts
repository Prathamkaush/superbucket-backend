import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { DelhiveryService } from "./delhivery.service";

@Injectable()
export class ShippingCronService {
  private readonly logger = new Logger("ShippingCron");

  constructor(
    private prisma: PrismaService,
    private delhiveryService: DelhiveryService
  ) {}

  // ================= CRON: EVERY 30 MIN =================
  @Cron("*/30 * * * *")
  async syncShipments() {
    this.logger.log("Starting shipment sync...");

    const orders = await this.prisma.order.findMany({
      where: {
        courier: "DELHIVERY",
        trackingId: { not: null },
        status: { in: ["SHIPPED", "CONFIRMED"] },
      },
      select: {
        id: true,
        trackingId: true,
      },
    });

    if (!orders.length) {
      this.logger.log("No active shipments found");
      return;
    }

    for (const order of orders) {
      try {
        await this.delhiveryService.trackShipment(
          order.trackingId!
        );
      } catch (err) {
        this.logger.error(
          `Tracking failed for order ${order.id}`,
          err.message
        );
      }
    }

    this.logger.log(
      `Shipment sync completed (${orders.length} orders)`
    );
  }
}
