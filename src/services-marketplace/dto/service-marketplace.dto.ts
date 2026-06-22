import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { ServiceBookingStatus, ServiceProviderStatus } from "@prisma/client";

export class CreateServiceCategoryDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() slug: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdateServiceCategoryDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() @IsNotEmpty() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class CreateServicePackageDto {
  @Type(() => Number) @IsInt() categoryId: number;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsNumber() @Min(0) price: number;
  @Type(() => Number) @IsInt() @Min(15) durationMinutes: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) platformFeePercent?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateServicePackageDto {
  @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) durationMinutes?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) platformFeePercent?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateServiceBookingDto {
  @Type(() => Number) @IsInt() packageId: number;
  @IsDateString() scheduledAt: string;
  @IsObject() address: Record<string, unknown>;
  @IsOptional() @IsString() customerNote?: string;
}

export class CancelServiceBookingDto {
  @IsString() @IsNotEmpty() reason: string;
}

export class ReviewServiceBookingDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() review?: string;
}

export class UpsertProviderProfileDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) experienceYears?: number;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) serviceRadiusKm?: number;
  @IsArray() @Type(() => Number) @IsInt({ each: true }) categoryIds: number[];
}

export class SetProviderAvailabilityDto {
  @IsBoolean() isOnline: boolean;
}

export class UpdateProviderJobStatusDto {
  @IsEnum(ServiceBookingStatus) status: ServiceBookingStatus;
  @IsOptional() @IsString() completionOtp?: string;
}

export class UpdateProviderApprovalDto {
  @IsEnum(ServiceProviderStatus) status: ServiceProviderStatus;
  @IsOptional() @IsString() rejectionReason?: string;
}
