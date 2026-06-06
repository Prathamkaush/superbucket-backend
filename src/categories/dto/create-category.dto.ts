import { IsOptional, IsString, IsNotEmpty } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  image?: string;
}
