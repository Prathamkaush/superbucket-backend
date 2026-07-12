import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class AdminBroadcastNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(800)
  body: string;

  @IsOptional()
  @IsIn(["ALL", "USERS", "DELIVERY_PARTNERS", "PROPERTY_OWNERS"])
  audience?: "ALL" | "USERS" | "DELIVERY_PARTNERS" | "PROPERTY_OWNERS";
}
