import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy } from "../auth/strategies/jwt.strategy";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { DeliveryPartnerController } from "./delivery-partner.controller";
import { DeliveryPartnerService } from "./delivery-partner.service";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "your-secret-key",
      signOptions: { expiresIn: "30d" },
    }),
  ],
  controllers: [DeliveryPartnerController],
  providers: [DeliveryPartnerService, JwtAuthGuard, JwtStrategy],
})
export class DeliveryPartnerModule {}
