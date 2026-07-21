import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from "class-validator";
import { ServiceBookingStatus, ServiceProviderStatus } from "@prisma/client";

export class CreateServiceCategoryDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() slug: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdateServiceCategoryDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() @IsNotEmpty() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class CreateServiceBookingDto {
  @Type(() => Number) @IsInt() packageId: number;
  @IsOptional() @Type(() => Number) @IsInt() providerId?: number;
  @IsDateString() scheduledAt: string;
  @IsObject() address: Record<string, unknown>;
  @IsOptional() @IsString() customerNote?: string;
}

export class CreateServiceRequestDto {
  @Type(() => Number) @IsInt() categoryId: number;
  @IsDateString() scheduledAt: string;
  @IsString() @IsNotEmpty() address: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) description: string;
}

export class SendServiceMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) body: string;
}

export class SubmitServiceQuoteDto {
  @Type(() => Number) @IsNumber() @Min(0) amount: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsDateString() scheduledAt?: string;
}

export class NegotiateServiceQuoteDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) message: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) amount?: number;
}

export class PayServiceBookingDto {
  @IsOptional() @IsIn(["CASH", "UPI", "DIRECT"]) method?: "CASH" | "UPI" | "DIRECT";
}

export class CancelServiceBookingDto {
  @IsString() @IsNotEmpty() reason: string;
}

export class RequestServiceRevisitDto {
  @IsOptional() @IsString() reason?: string;
}

export class CreateServiceExtensionDto {
  @IsString() @IsNotEmpty() @MaxLength(100) serviceName: string;
  @IsString() @IsNotEmpty() @MaxLength(100) customerName: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1440) durationMinutes: number;
  @Type(() => Number) @IsNumber() @Min(0) charge: number;
}

export class AcceptServiceRevisitDto {
  @IsDateString() scheduledAt: string;
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
