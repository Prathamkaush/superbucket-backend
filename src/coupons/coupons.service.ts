import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async createCoupon(dto: CreateCouponDto) {
    const exists = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (exists) {
      throw new BadRequestException("Coupon code already exists");
    }

    return this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type,
        value: dto.value,
        minOrderValue: dto.minOrderValue,
        maxDiscount: dto.maxDiscount,
        usageLimit: dto.usageLimit,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async getAll() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(id: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) throw new NotFoundException("Coupon not found");
    return coupon;
  }

  async updateCoupon(id: number, dto: UpdateCouponDto) {
  await this.getById(id);

  return this.prisma.coupon.update({
    where: { id },
    data: {
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.value !== undefined && { value: dto.value }),
      ...(dto.minOrderValue !== undefined && { minOrderValue: dto.minOrderValue }),
      ...(dto.maxDiscount !== undefined && { maxDiscount: dto.maxDiscount }),
      ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
      ...(dto.expiresAt !== undefined && {
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    },
  });
}


  async toggleCoupon(id: number) {
    const coupon = await this.getById(id);

    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive },
    });
  }

  async deleteCoupon(id: number) {
    await this.getById(id);
    return this.prisma.coupon.delete({ where: { id } });
  }
async validateCoupon(dto: {
  code: string;
  orderAmount: number;
  userId?: number;
}) {
  const code = dto.code.toUpperCase();

  /* ================= FIRST TIME COUPON ================= */
  if (code === "FIRSTFEMALE") {
    if (!dto.userId) {
      return { valid: false, message: "Login required" };
    }

    const orderCount = await this.prisma.order.count({
      where: { userId: dto.userId },
    });

    if (orderCount > 0) {
      return {
        valid: false,
        message: "Coupon valid only for first-time users",
      };
    }

    const discount = Math.min(100, dto.orderAmount); // ₹100 flat

    return {
      valid: true,
      discount,
      finalAmount: dto.orderAmount - discount,
      message: "Welcome offer applied 🎉",
    };
  }

  /* ================= DB COUPONS ================= */
  const coupon = await this.prisma.coupon.findUnique({
    where: { code },
  });

  if (!coupon || !coupon.isActive) {
    return { valid: false, message: "Invalid coupon" };
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { valid: false, message: "Coupon expired" };
  }

  if (
    coupon.minOrderValue &&
    dto.orderAmount < Number(coupon.minOrderValue)
  ) {
    return {
      valid: false,
      message: `Minimum order value is ₹${coupon.minOrderValue}`,
    };
  }

  if (
    coupon.usageLimit !== null &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    return { valid: false, message: "Coupon usage limit exceeded" };
  }

  let discount =
    coupon.type === "PERCENT"
      ? (dto.orderAmount * Number(coupon.value)) / 100
      : Number(coupon.value);

  if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
    discount = Number(coupon.maxDiscount);
  }

  discount = Math.min(discount, dto.orderAmount);

  return {
    valid: true,
    discount: Math.round(discount),
    finalAmount: Math.round(dto.orderAmount - discount),
    message: "Coupon applied successfully",
  };
}

async getAvailableCoupons() {
  const coupons = await this.prisma.coupon.findMany({
    where: {
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = coupons.map(c => ({
    code: c.code,
    type: c.type,
    value: Number(c.value),
    minOrderValue: c.minOrderValue
      ? Number(c.minOrderValue)
      : null,
    maxDiscount: c.maxDiscount
      ? Number(c.maxDiscount)
      : null,
    description:
      c.type === "PERCENT"
        ? `${c.value}% OFF`
        : `₹${c.value} OFF`,
  }));

  // 🔥 HARD-CODED FIRST-TIME USER COUPON (DISPLAY ONLY)
  formatted.unshift({
    code: "FIRSTFEMALE",
    type: "FLAT",
    value: 100,
    minOrderValue: null,
    maxDiscount: 100,
    description: "₹100 OFF for first-time users",
  });

  return formatted;
}
}
