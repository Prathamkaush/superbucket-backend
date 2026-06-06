import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { InfluencerService } from "./influencer.service";

@Controller("admin/influencer-items")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminInfluencerController {
  constructor(private service: InfluencerService) {}

  @Post(":sectionId")
  add(
    @Param("sectionId", ParseIntPipe) sectionId: number,
    @Body() dto: {
      mediaId?: number;
      embedUrl?: string;
      productId: number;
      influencerName?: string;
      ctaText?: string;
      position: number;
    }
  ) {
    return this.service.addItem(sectionId, dto);
  }

  @Put(":sectionId/bulk-sync")
  bulkSync(
    @Param("sectionId", ParseIntPipe) sectionId: number,
    @Body() dto: {
      items: Array<{
        mediaId?: number;
        mediaType?: string;
        embedUrl?: string;
        productId: number;
        influencerName?: string;
        ctaText?: string;
        position: number;
      }>;
    }
  ) {
    return this.service.bulkSync(sectionId, dto.items);
  }

  @Get("section/:sectionId")
  getBySection(@Param("sectionId", ParseIntPipe) sectionId: number) {
    return this.service.getItemsBySection(sectionId);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: {
      mediaId?: number;
      mediaType?: string;
      embedUrl?: string;
      productId?: number;
      influencerName?: string;
      ctaText?: string;
      position?: number;
    }
  ) {
    return this.service.updateItem(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteItem(id);
  }

  @Patch("reorder")
  reorder(@Body() items: { id: number; position: number }[]) {
    return this.service.reorder(items);
  }
}