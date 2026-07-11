import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Matches,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from "class-validator";

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: "Phone number must contain a valid 10-digit Indian mobile number",
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  street: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: "Pincode must contain exactly 6 digits",
  })
  pincode: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(6)
  @Max(38)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(68)
  @Max(98)
  longitude?: number;
}
