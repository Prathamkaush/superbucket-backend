import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import {
  AdminHomeOffersController,
  PublicHomeOffersController,
} from "./home-offers.controller";
import { HomeOffersService } from "./home-offers.service";
import { PaymentsModule } from "../payment/payments.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, PaymentsModule, NotificationsModule],
  controllers: [PublicHomeOffersController, AdminHomeOffersController],
  providers: [HomeOffersService],
})
export class HomeOffersModule {}
