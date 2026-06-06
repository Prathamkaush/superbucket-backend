import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateReviewDto {
  @IsInt()
  productId: number;

  @IsOptional()
  @IsInt()
  orderId?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
