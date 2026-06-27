import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, Matches } from "class-validator";
import { PropertyMode, PropertyCategory, PropertyFurnished } from "@prisma/client";

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "pincode must be a valid 6-digit PIN code" })
  pincode: string;

  @IsEnum(PropertyMode)
  @IsNotEmpty()
  mode: PropertyMode;

  @IsEnum(PropertyCategory)
  @IsNotEmpty()
  category: PropertyCategory;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsOptional()
  floor?: string;

  @IsEnum(PropertyFurnished)
  @IsOptional()
  furnished?: PropertyFurnished;

  @IsString()
  @IsOptional()
  details?: string;
}
