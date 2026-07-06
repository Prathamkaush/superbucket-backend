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

  @Post("add-credit")
  addCredit(@Req() req: any, @Body() body: { amount: number; label?: string }) {
    return this.wallet.addCredit(req.user.id, Number(body.amount), body.label);
  }
}
