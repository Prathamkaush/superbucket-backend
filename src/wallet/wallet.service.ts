import { BadRequestException, Injectable } from "@nestjs/common";
import { WalletTransactionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async ensureWallet(userId: number) {
    return this.prisma.walletAccount.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async getMine(userId: number) {
    const wallet = await this.ensureWallet(userId);
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return { wallet, transactions };
  }

  async addCredit(userId: number, amountValue: number, label = "Money added to wallet") {
    const amount = Number(amountValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Enter a valid wallet amount");
    }
    if (amount > 5000) {
      throw new BadRequestException("Static wallet credit cannot exceed Rs 5000");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.upsert({
        where: { userId },
        update: { balance: { increment: amount } },
        create: { userId, balance: amount },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: WalletTransactionType.CREDIT,
          amount,
          label,
          reference: `wallet_${Date.now()}`,
        },
      });
      return { wallet, transaction };
    });

    this.notifications.notifyWalletCredit(userId, amount).catch(() => undefined);
    return result;
  }
}
