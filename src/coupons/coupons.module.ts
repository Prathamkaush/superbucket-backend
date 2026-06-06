import { Module } from "@nestjs/common";
import { CouponsService } from "./coupons.service";
import { AdminCouponsController , CouponsPublicController } from "./coupons.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [CouponsService],
  controllers: [AdminCouponsController, CouponsPublicController],
  exports: [CouponsService], 
})
export class CouponsModule {}