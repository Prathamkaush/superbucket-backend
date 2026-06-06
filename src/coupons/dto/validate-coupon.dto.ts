import { IsString, IsNumber } from "class-validator";

export class ValidateCouponDto {
  @IsString()
  code: string;

  @IsNumber()
  orderAmount: number;
}
