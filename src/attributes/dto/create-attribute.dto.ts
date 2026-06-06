import { IsString, IsOptional, IsHexColor, MinLength } from "class-validator";

export class CreateAttributeDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  slug: string;

  // Only used for Color
  @IsOptional()
  @IsHexColor()
  hex?: string;
}
