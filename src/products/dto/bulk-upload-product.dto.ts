import { IsNotEmpty, IsOptional, IsNumber, IsString, IsBoolean, IsEnum, Min, Max, ValidateIf } from 'class-validator';

export class BulkUploadProductDto {
  @IsNotEmpty()
  dataFile: Express.Multer.File;

  @IsOptional()
  imageZip?: Express.Multer.File;
}

export class BulkUploadValidateDto {
  @IsNotEmpty()
  dataFile: Express.Multer.File;

  @IsOptional()
  imageZip?: Express.Multer.File;
}

export interface ParsedProductRow {
  // Required fields
  title: string;
  categoryId: number;
  typeId: number;
  subtypeId: number;
  price: number;
  _original?: any;
  stock: number;
  weight: number;

  // Optional fields
  description?: string;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  isTrending?: boolean;
  freeShipping?: boolean;
  estimatedShipping?: number;
  seasonId?: number;

  // Sizes (format: "S:10,M:20,L:15")
  sizes?: string;

  // Attributes (format: "1,2,3" - comma-separated IDs)
  colors?: string;
  fabrics?: string;
  occasions?: string;
  fits?: string;
  sleeves?: string;
  patterns?: string;

  // Vendor info (format: "vendorId:costPrice:fabricType:quantity|...")
  vendors?: string;

  // Images (URLs or file paths)
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;

  // SEO fields
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
}

export interface BulkUploadResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    rowNumber: number;
    title: string;
    error: string;
  }>;
  successfulProducts: Array<{
    rowNumber: number;
    productId: number;
    title: string;
    slug: string;
  }>;
  imageStats: {
    total: number;
    used: number;
    unused: string[];
  };
}

export interface BulkUploadValidationResult {
  total: number;
  valid: number;
  invalid: number;
  warnings: Array<{
    rowNumber: number;
    title: string;
    warnings: string[];
  }>;
  errors: Array<{
    rowNumber: number;
    title: string;
    errors: string[];
    warnings?: string[];
  }>;
  imageStats: {
    totalInZip: number;
    referenced: number;
    missing: string[];
    unreferenced: string[];
  };
}