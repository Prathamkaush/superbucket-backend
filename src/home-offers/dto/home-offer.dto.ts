import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

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
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

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
