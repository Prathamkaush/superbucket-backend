import { Controller, Post, Body, Headers } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrderStatus } from "@prisma/client";

@Controller("webhooks/delhivery")
export class DelhiveryWebhookController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async handleWebhook(
    @Body() payload: any,
    @Headers("x-webhook-secret") secret: string
  ) {
    // 🔐 Security check
    if (secret !== process.env.DELHIVERY_WEBHOOK_SECRET) {
      return { ok: true };
    }

    const waybill = payload?.waybill;
    const statusText: string = payload?.status || "";

    if (!waybill || !statusText) return { ok: true };

    const order = await this.prisma.order.findFirst({
      where: { trackingId: waybill },
    });

    if (!order) return { ok: true };

    const normalized = statusText.toLowerCase();

    // 🚚 Shipped states
    if (
      ["in transit", "out for delivery", "reached"].some(s =>
        normalized.includes(s)
      )
    ) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.SHIPPED,
          shippedAt: order.shippedAt ?? new Date(),
        },
      });
    }

    // ✅ Delivered state
    if (normalized.includes("delivered")) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: order.deliveredAt ?? new Date(),
        },
      });
    }

    return { success: true };
  }
}
