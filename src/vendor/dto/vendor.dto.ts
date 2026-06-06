// dto/vendor.dto.ts
import { IsString, IsEmail, IsEnum, IsOptional, IsPhoneNumber } from 'class-validator';
import { VendorType } from '@prisma/client';

export class CreateVendorDto {
  @IsString()
  companyName: string;

  @IsString()
  contactPersonName: string;

  @IsString()
  contactNumber: string;

  @IsEmail()
  emailId: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsString()
  address: string;

  @IsEnum(VendorType)
  vendorType: VendorType;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  contactPersonName?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(VendorType)
  vendorType?: VendorType;
}