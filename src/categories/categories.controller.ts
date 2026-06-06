import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { mkdirSync } from "fs";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";

// ✅ Swagger imports
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiConsumes,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";

@ApiTags("Categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  private static imageStorage = diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), "uploads", "categories");
      mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + extname(file.originalname));
    },
  });

  // ---------------- CREATE CATEGORY (ADMIN) ----------------
  @ApiOperation({
    summary: "Create a category (Admin only)",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: CreateCategoryDto })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor("image", { storage: CategoriesController.imageStorage }))
  @Post()
  create(@Body() dto: CreateCategoryDto, @UploadedFile() image?: Express.Multer.File) {
    return this.categoriesService.create(dto, image?.filename);
  }

  // ---------------- GET ALL CATEGORIES ----------------
  @ApiOperation({
    summary: "Get all categories",
  })
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  // ---------------- GET CATEGORY BY ID ----------------
  @ApiOperation({
    summary: "Get category by ID",
  })
  @ApiParam({
    name: "id",
    description: "Category ID",
    example: 1,
  })
  @ApiBadRequestResponse({ description: "Invalid category ID" })
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  // ---------------- UPDATE CATEGORY (ADMIN) ----------------
  @ApiOperation({
    summary: "Update category (Admin only)",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiConsumes("multipart/form-data")
  @ApiParam({
    name: "id",
    description: "Category ID",
    example: 1,
  })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor("image", { storage: CategoriesController.imageStorage }))
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() image?: Express.Multer.File
  ) {
    return this.categoriesService.update(id, {
      ...dto,
      ...(image ? { image: image.filename } : {}),
    });
  }

  // ---------------- DELETE CATEGORY (ADMIN) ----------------
  @ApiOperation({
    summary: "Delete category (Admin only)",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({
    name: "id",
    description: "Category ID",
    example: 1,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}
