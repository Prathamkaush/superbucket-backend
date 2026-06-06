import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { OrderStatus } from "@prisma/client";

// ✅ Swagger imports
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { OrdersService } from "../orders/orders.service";

@ApiTags("Payments")
@ApiBearerAuth("JWT-auth")
@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  // ================= CREATE RAZORPAY ORDER =================

  @ApiOperation({
    summary: "Create Razorpay order",
    description:
      "Creates a Razorpay payment order for a pending user order",
  })
  @ApiBody({
    schema: {
      example: {
        amount: 1000,
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      "Invalid amount",
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @UseGuards(JwtAuthGuard)
  @Post("razorpay/create-order")
  async createRazorpayOrder(@Body() body: { amount: number }) {
    if (!body?.amount || body.amount <= 0) {
      throw new BadRequestException("Invalid amount");
    }

    const razorpayOrder = await this.paymentsService.createOrder(body.amount);

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // already in paise
      key: process.env.RAZORPAY_KEY_ID,
    };
  }

  // ================= VERIFY PAYMENT =================

  @ApiOperation({
    summary: "Verify Razorpay payment",
    description:
      "Verifies Razorpay payment signature and confirms the order",
  })
  @ApiBody({
    schema: {
      example: {
        razorpay_order_id: "order_Nx123abc",
        razorpay_payment_id: "pay_Nx456xyz",
        razorpay_signature: "generated_signature_here",
        address: {
          name: "John Doe",
          street: "123 Main St",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
          phone: "9876543210"
        },
        couponCode: "WELCOME10"
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      "Invalid signature | Order not found | Unauthorized | Already processed",
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @UseGuards(JwtAuthGuard)
  @UseGuards(JwtAuthGuard)
@Post("razorpay/verify")
async verifyPayment(@Req() req, @Body() body) {
  const crypto = require("crypto");

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    address,
    couponCode,
  } = body;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (expected !== razorpay_signature) {
    throw new BadRequestException("Invalid signature");
  }

  // ✅ Correct call
  const order = await this.ordersService.createOrder(req.user.id, {
    address,
    paymentMethod: "RAZORPAY",
    couponCode,
  });

  await this.prisma.order.update({
    where: { id: order.orderId },
    data: {
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      paidAt: new Date(),
      status: OrderStatus.CONFIRMED,
    },
  });

  return { success: true, orderId: order.orderId };
}

}