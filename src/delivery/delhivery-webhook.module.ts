import { Module } from "@nestjs/common";
import { DelhiveryWebhookController } from "./delhivery-webhook.controller";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [DelhiveryWebhookController],
  providers: [PrismaService],
})
export class DelhiveryWebhookModule {}
