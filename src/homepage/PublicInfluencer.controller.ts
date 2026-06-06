import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { InfluencerService } from "./influencer.service";

@Controller("public/influencer")
export class PublicInfluencerController {
  constructor(private readonly service: InfluencerService) {}

  // GET /public/influencer/section/3
  @Get("section/:sectionId")
  getSectionItems(
    @Param("sectionId", ParseIntPipe) sectionId: number
  ) {
    return this.service.getItemsBySection(sectionId);
  }
}
