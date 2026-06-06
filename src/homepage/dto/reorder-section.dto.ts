import { IsInt } from "class-validator";

export class ReorderHomepageSectionDto {
  @IsInt()
  id: number;

  @IsInt()
  position: number;
}
