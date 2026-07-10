import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, Matches, Max, Min } from "class-validator";
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

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(9999999999999.99, { message: "price is too high" })
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
