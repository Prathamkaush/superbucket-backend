import { IsString, IsOptional, IsDateString } from "class-validator";

export class CreateLeadDto {
  @IsString()
  @IsOptional()
  message?: string;

  @IsDateString()
  @IsOptional()
  visitTime?: string;
}
