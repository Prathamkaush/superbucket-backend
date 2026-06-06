import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { HomeSectionType } from "@prisma/client";

export class UpdateHomepageSectionDto {
  @IsOptional()
  @IsEnum(HomeSectionType)
  type?: HomeSectionType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  
  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  config?: any;
}
