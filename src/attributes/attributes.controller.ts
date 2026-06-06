import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { AttributesService } from "./attributes.service";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { CreateAttributeDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";

@Controller("attributes")
export class AttributesController {
  constructor(private readonly service: AttributesService) {}

  /* ================= READ (PUBLIC) ================= */

  @Get("colors")
  getColors() {
    return this.service.getColors();
  }

  @Get("seasons")
  getSeasons() {
    return this.service.getSeasons();
  }

  @Get("fabrics")
  getFabrics() {
    return this.service.getFabrics();
  }

  @Get("occasions")
  getOccasions() {
    return this.service.getOccasions();
  }

  @Get("fits")
  getFits() {
    return this.service.getFits();
  }

  @Get("sleeves")
  getSleeves() {
    return this.service.getSleeves();
  }

  @Get("patterns")
  getPatterns() {
    return this.service.getPatterns();
  }

  /* ================= COLORS ================= */

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("colors")
  createColor(@Body() body: CreateAttributeDto) {
    return this.service.createColor(body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("colors/:id")
  updateColor(
    @Param("id") id: string,
    @Body() body: UpdateAttributeDto
  ) {
    return this.service.updateColor(+id, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete("colors/:id")
  deleteColor(@Param("id") id: string) {
    return this.service.deleteColor(+id);
  }

  /* ================= SEASONS ================= */

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("seasons")
  createSeason(@Body() body: CreateAttributeDto) {
    return this.service.createSeason(body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("seasons/:id")
  updateSeason(
    @Param("id") id: string,
    @Body() body: UpdateAttributeDto
  ) {
    return this.service.updateSeason(+id, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete("seasons/:id")
  deleteSeason(@Param("id") id: string) {
    return this.service.deleteSeason(+id);
  }

  /* ================= FABRICS ================= */

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("fabrics")
  createFabric(@Body() body: CreateAttributeDto) {
    return this.service.createFabric(body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("fabrics/:id")
  updateFabric(
    @Param("id") id: string,
    @Body() body: UpdateAttributeDto
  ) {
    return this.service.updateFabric(+id, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete("fabrics/:id")
  deleteFabric(@Param("id") id: string) {
    return this.service.deleteFabric(+id);
  }

  /* ================= OCCASIONS ================= */

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("occasions")
  createOccasion(@Body() body: CreateAttributeDto) {
    return this.service.createOccasion(body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("occasions/:id")
  updateOccasion(
    @Param("id") id: string,
    @Body() body: UpdateAttributeDto
  ) {
    return this.service.updateOccasion(+id, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete("occasions/:id")
  deleteOccasion(@Param("id") id: string) {
    return this.service.deleteOccasion(+id);
  }

  /* ================= FITS ================= */

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("fits")
  createFit(@Body() body: CreateAttributeDto) {
    return this.service.createFit(body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("fits/:id")
  updateFit(
    @Param("id") id: string,
    @Body() body: UpdateAttributeDto
  ) {
    return this.service.updateFit(+id, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete("fits/:id")
  deleteFit(@Param("id") id: string) {
    return this.service.deleteFit(+id);
  }

  /* ================= SLEEVES ================= */

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("sleeves")
  createSleeve(@Body() body: CreateAttributeDto) {
    return this.service.createSleeve(body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("sleeves/:id")
  updateSleeve(
    @Param("id") id: string,
    @Body() body: UpdateAttributeDto
  ) {
    return this.service.updateSleeve(+id, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete("sleeves/:id")
  deleteSleeve(@Param("id") id: string) {
    return this.service.deleteSleeve(+id);
  }

  /* ================= PATTERNS ================= */

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("patterns")
  createPattern(@Body() body: CreateAttributeDto) {
    return this.service.createPattern(body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("patterns/:id")
  updatePattern(
    @Param("id") id: string,
    @Body() body: UpdateAttributeDto
  ) {
    return this.service.updatePattern(+id, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete("patterns/:id")
  deletePattern(@Param("id") id: string) {
    return this.service.deletePattern(+id);
  }
}
