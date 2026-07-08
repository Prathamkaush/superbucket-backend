import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import {
  AdminHomeOffersController,
  PublicHomeOffersController,
} from "./home-offers.controller";
import { HomeOffersService } from "./home-offers.service";

@Module({
  imports: [PrismaModule],
  controllers: [PublicHomeOffersController, AdminHomeOffersController],
  providers: [HomeOffersService],
})
export class HomeOffersModule {}
