import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

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
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsIn(["ALL", "USERS", "DELIVERY_PARTNERS", "PROPERTY_OWNERS"])
  audience?: "ALL" | "USERS" | "DELIVERY_PARTNERS" | "PROPERTY_OWNERS";
}
