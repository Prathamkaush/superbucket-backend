import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @ApiProperty({ example: "Pratham Kaushik" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: "pratham@example.com" })
  @IsEmail()
  @MaxLength(191)
  email: string;

  @ApiProperty({
    example: "9876543210",
    description: "Required 10-digit phone number",
  })
  @IsString()
  @Matches(/^\d{10}$/, {
    message: "Phone number must contain exactly 10 digits",
  })
  phone: string;

  @ApiProperty({ type: "string", format: "binary", required: false })
  image?: unknown;
}
