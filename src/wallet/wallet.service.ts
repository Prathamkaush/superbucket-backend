import { BadRequestException, Injectable } from "@nestjs/common";
import { WalletTransactionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentsService } from "../payment/payments.service";

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
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

  async createTopupOrder(amountValue: number) {
    const amount = Number(amountValue);
    if (!Number.isFinite(amount) || amount < 100) {
      throw new BadRequestException("Minimum wallet top-up is Rs 100");
    }
    if (amount > 50000) {
      throw new BadRequestException("Wallet top-up cannot exceed Rs 50000");
    }

    const razorpayOrder = await this.payments.createOrder(amount);
    return {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      key: process.env.RAZORPAY_KEY_ID,
    };
  }

  async verifyTopupPayment(
    userId: number,
    payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      amount: number;
    },
  ) {
    const crypto = require("crypto");
    const amount = Number(payload.amount);

    if (!Number.isFinite(amount) || amount < 100) {
      throw new BadRequestException("Minimum wallet top-up is Rs 100");
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(payload.razorpay_order_id + "|" + payload.razorpay_payment_id)
      .digest("hex");

    if (expected !== payload.razorpay_signature) {
      throw new BadRequestException("Invalid payment signature");
    }

    const existing = await this.prisma.walletTransaction.findFirst({
      where: { reference: payload.razorpay_payment_id },
    });

    if (existing) {
      const wallet = await this.ensureWallet(userId);
      return { wallet, transaction: existing, success: true };
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
          label: "Money added via Razorpay",
          reference: payload.razorpay_payment_id,
        },
      });
      return { wallet, transaction, success: true };
    });

    this.notifications.notifyWalletCredit(userId, amount).catch(() => undefined);
    return result;
  }
}
