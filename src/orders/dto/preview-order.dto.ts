import { IsOptional, IsString, IsIn } from "class-validator";

export class PreviewOrderDto {
  address: any;

  @IsIn(["COD", "RAZORPAY"])
  paymentMethod: "COD" | "RAZORPAY";

  @IsOptional()
  @IsString()
  couponCode?: string;
}
