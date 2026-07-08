import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payment/payments.module";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [NotificationsModule, PaymentsModule],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
