import { IsEnum, IsNumber, IsOptional, IsDateString } from "class-validator";
import { CouponType } from "@prisma/client";

export class UpdateCouponDto {
  @IsEnum(CouponType)
  @IsOptional()
  type?: CouponType;

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsNumber()
  @IsOptional()
  minOrderValue?: number;

  @IsNumber()
  @IsOptional()
  maxDiscount?: number;

  @IsNumber()
  @IsOptional()
  usageLimit?: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
