import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { PartialType } from "@nestjs/mapped-types";

export class CreateHomeOfferDto {
  @IsString()
  @MaxLength(80)
  title: string;

  @IsString()
  @MaxLength(140)
  subtitle: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  buttonLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateHomeOfferDto extends CreateHomeOfferDto {}

export class CreateBusinessAdDto {
  @IsOptional()
  @IsIn(["BUSINESS", "LOCAL_SHOP"])
  adType?: "BUSINESS" | "LOCAL_SHOP";

  @Type(() => Number)
  @IsInt()
  planId: number;

  @IsString()
  @MaxLength(80)
  businessName: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsString()
  @MaxLength(140)
  description: string;

  @IsString()
  @MaxLength(180)
  address: string;

  @IsString()
  @MaxLength(15)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  offer?: string;

}

export class UpdateBusinessAdDto extends PartialType(CreateBusinessAdDto) {}

export class CreateBusinessAdPlanDto {
  @IsString()
  @MaxLength(60)
  name: string;

  @Type(() => Number)
  @IsNumber()
  price: number;

  @Type(() => Number)
  @IsInt()
  durationDays: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateBusinessAdPlanDto extends PartialType(CreateBusinessAdPlanDto) {}

export class ReviewBusinessAdDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class VerifyBusinessAdPaymentDto {
  @IsString() razorpay_order_id: string;
  @IsString() razorpay_payment_id: string;
  @IsString() razorpay_signature: string;
}
