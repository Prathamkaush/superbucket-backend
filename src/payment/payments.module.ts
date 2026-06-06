import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PrismaModule } from "../prisma/prisma.module";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [
    PrismaModule,
    OrdersModule, // ✅ THIS FIXES THE ERROR
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
