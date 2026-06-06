import { Module } from "@nestjs/common";
import { DelhiveryService } from "./delhivery.service";
import { DelhiveryAdminController  , DeliveryPublicController } from "./delhivery.controller";
import { ShippingCronService } from "./shipping-cron.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [
    DelhiveryService,
    ShippingCronService, // ✅ ADD
  ],
  controllers: [DelhiveryAdminController  , DeliveryPublicController],
})
export class DelhiveryModule {}
