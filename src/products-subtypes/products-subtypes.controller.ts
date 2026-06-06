import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ProductSubtypesService } from "./products-subtypes.service";
import { CreateProductSubtypeDto } from "./dto/create-product-subtype.dto";
import { UpdateProductSubtypeDto } from "./dto/update-product-subtype.dto";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";

// ✅ Swagger imports
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";

@ApiTags("Product Subtypes")
@Controller("product-subtypes")
export class ProductSubtypesController {
  constructor(
    private readonly productSubtypesService: ProductSubtypesService
  ) {}

  // ================= CREATE =================
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create product subtype (Admin)",
    description: "Creates a new product subtype under a product type",
  })
  @ApiBody({ type: CreateProductSubtypeDto })
  @ApiUnauthorizedResponse({ description: "Admin authentication required" })
  @ApiBadRequestResponse({ description: "Invalid subtype data" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() dto: CreateProductSubtypeDto) {
    return this.productSubtypesService.create(dto);
  }

  // ================= LIST =================
  @ApiOperation({
    summary: "Get all product subtypes",
    description: "Optionally filter subtypes by product type",
  })
  @ApiQuery({
    name: "typeId",
    required: false,
    type: Number,
    description: "Filter subtypes by product type ID",
  })
  @Get()
  findAll(@Query("typeId") typeId?: string) {
    const tid = typeId ? parseInt(typeId, 10) : undefined;
    return this.productSubtypesService.findAll(tid);
  }

  // ================= GET ONE =================
  @ApiOperation({
    summary: "Get product subtype by ID",
  })
  @ApiParam({
    name: "id",
    type: Number,
    description: "Product subtype ID",
  })
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.productSubtypesService.findOne(id);
  }

  // ================= UPDATE =================
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update product subtype (Admin)",
  })
  @ApiParam({
    name: "id",
    type: Number,
    description: "Product subtype ID",
  })
  @ApiBody({ type: UpdateProductSubtypeDto })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProductSubtypeDto
  ) {
    return this.productSubtypesService.update(id, dto);
  }

  // ================= DELETE =================
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete product subtype (Admin)",
  })
  @ApiParam({
    name: "id",
    type: Number,
    description: "Product subtype ID",
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.productSubtypesService.remove(id);
  }
@UseGuards(JwtAuthGuard, AdminGuard)
@Get("admin/all")
findAllForAdmin() {
  return this.productSubtypesService.findAllWithType();
}
}

