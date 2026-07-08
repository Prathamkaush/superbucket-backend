import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { WalletService } from "./wallet.service";

@UseGuards(JwtAuthGuard)
@Controller("wallet")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get("me")
  getMine(@Req() req: any) {
    return this.wallet.getMine(req.user.id);
  }

  @Post("topup/razorpay/create-order")
  createTopupOrder(@Body() body: { amount: number }) {
    return this.wallet.createTopupOrder(Number(body.amount));
  }

  @Post("topup/razorpay/verify")
  verifyTopupPayment(@Req() req: any, @Body() body: any) {
    return this.wallet.verifyTopupPayment(req.user.id, body);
  }
}
