import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  gstRate?: number;

  @IsNumber()
  stock: number;

  @IsArray()
  sizes: string[];

  @IsOptional() img1?: string;
  @IsOptional() img2?: string;
  @IsOptional() img3?: string;
  @IsOptional() img4?: string;

  @IsNumber()
  categoryId: number;

  @IsOptional()
  @IsNumber()
  typeId?: number;

  @IsOptional()
  @IsNumber()
  subtypeId?: number;
}
