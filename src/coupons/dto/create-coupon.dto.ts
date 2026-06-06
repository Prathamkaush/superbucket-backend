import { IsEnum, IsOptional, IsNumber, IsString, IsDateString } from "class-validator";
import { CouponType } from "@prisma/client";

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsEnum(CouponType)
  type: CouponType;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsNumber()
  minOrderValue?: number;

  @IsOptional()
  @IsNumber()
  maxDiscount?: number;

  @IsOptional()
  @IsNumber()
  usageLimit?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
