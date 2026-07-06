import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsOptional()
  @IsIn(["ANDROID", "IOS", "WEB"])
  platform?: "ANDROID" | "IOS" | "WEB";

  @IsOptional()
  @IsString()
  @MaxLength(64)
  app?: string;
}
