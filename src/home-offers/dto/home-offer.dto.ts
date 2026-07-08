import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
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
