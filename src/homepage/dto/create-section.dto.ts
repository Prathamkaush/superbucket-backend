import { HomeSectionType } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString } from "class-validator";

export class CreateHomepageSectionDto {
  @IsEnum(HomeSectionType)
  type: HomeSectionType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsInt()
  position: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

   @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
