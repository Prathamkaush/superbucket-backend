import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { HomepageService } from "./homepage.service";
import { CreateHomepageSectionDto } from "./dto/create-section.dto";
import { UpdateHomepageSectionDto } from "./dto/update-section.dto";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { ReorderHomepageSectionDto } from "./dto/reorder-section.dto";

@Controller("admin/homepage")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminHomepageController {
  constructor(private service: HomepageService) {}

  @Get()
  getAll() {
    return this.service.getAllSections();
  }
 @Patch("reorder")
  reorder(@Body() items: ReorderHomepageSectionDto[]) {
    return this.service.reorder(items);
  }

  @Get(":id")  // ✅ ADD THIS
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  create(@Body() dto: CreateHomepageSectionDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateHomepageSectionDto
  ) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}