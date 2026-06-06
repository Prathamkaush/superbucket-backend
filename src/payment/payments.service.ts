import Razorpay from "razorpay";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

@Injectable()
export class PaymentsService {
  private getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException("Online payment is not configured");
    }

    return new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async createOrder(amount: number) {
    const amountInRupees = Number(amount);

    if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
      throw new BadRequestException("Invalid payment amount");
    }

    const amountInPaise = Math.round(amountInRupees * 100);

    try {
      return await this.getRazorpayClient().orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: "order_" + Date.now(),
      });
    } catch (error: any) {
      const message =
        error?.error?.description ||
        error?.error?.reason ||
        error?.message ||
        "Unable to create Razorpay order";

      throw new BadRequestException(message);
    }
  }
}
