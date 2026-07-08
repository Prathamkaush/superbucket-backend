import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { mkdirSync } from "fs";
import { PropertiesService } from "./properties.service";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import {
  PropertyCategory,
  PropertyMode,
  LeadStatus,
  PropertyStatus,
} from "@prisma/client";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";

@ApiTags("Properties")
@Controller("properties")
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  private static propertyStorage = diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), "uploads", "properties");
      mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + extname(file.originalname));
    },
  });

  // =========================================================================
  // PUBLIC / BUYER ROUTE LISTINGS
  // =========================================================================

  @ApiOperation({ summary: "Get all live properties (filtered)" })
  @ApiQuery({ name: "category", required: false, enum: PropertyCategory })
  @ApiQuery({ name: "mode", required: false, enum: PropertyMode })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "pincode", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @Get()
  findAll(
    @Query("category") category?: PropertyCategory,
    @Query("mode") mode?: PropertyMode,
    @Query("search") search?: string,
    @Query("pincode") pincode?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.propertiesService.findAll({
      category,
      mode,
      search,
      pincode,
      page,
      limit,
    });
  }

  @ApiOperation({ summary: "Get advertised properties/ads" })
  @Get("ads")
  findAdvertised() {
    return this.propertiesService.findAdvertised();
  }

  @ApiOperation({ summary: "Get details of a property listing" })
  @ApiParam({ name: "id", type: Number })
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.propertiesService.findOne(id, true); // true to increment views
  }

  @ApiOperation({ summary: "Submit an inquiry or schedule a visit (Buyer)" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Post(":id/inquire")
  createLead(
    @Req() req,
    @Param("id", ParseIntPipe) propertyId: number,
    @Body() dto: CreateLeadDto
  ) {
    return this.propertiesService.createLead(propertyId, req.user.id, dto);
  }

  // =========================================================================
  // OWNER / RENTER DASHBOARD & OPERATIONS
  // =========================================================================

  @ApiOperation({ summary: "List properties owned by current user" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Get("my/listings")
  findMyProperties(@Req() req) {
    return this.propertiesService.findMyProperties(req.user.id);
  }

  @ApiOperation({ summary: "List leads received on user's property listings" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Get("my/leads")
  findMyLeads(@Req() req) {
    return this.propertiesService.findMyLeads(req.user.id);
  }

  @ApiOperation({ summary: "Create a property listing (Renter/Seller)" })
  @ApiBearerAuth("JWT-auth")
  @ApiConsumes("multipart/form-data")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "frontImage", maxCount: 1 },
        { name: "roomsImage", maxCount: 1 },
        { name: "docsFile", maxCount: 1 },
      ],
      { storage: PropertiesController.propertyStorage }
    )
  )
  @Post()
  create(
    @Req() req,
    @Body() dto: CreatePropertyDto,
    @UploadedFiles()
    files: {
      frontImage?: Express.Multer.File[];
      roomsImage?: Express.Multer.File[];
      docsFile?: Express.Multer.File[];
    }
  ) {
    const frontImage = files?.frontImage?.[0]?.filename;
    const roomsImage = files?.roomsImage?.[0]?.filename;
    const docsFile = files?.docsFile?.[0]?.filename;

    return this.propertiesService.createProperty(req.user.id, dto, {
      frontImage,
      roomsImage,
      docsFile,
    });
  }

  @ApiOperation({ summary: "Update a property listing" })
  @ApiBearerAuth("JWT-auth")
  @ApiConsumes("multipart/form-data")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "frontImage", maxCount: 1 },
        { name: "roomsImage", maxCount: 1 },
        { name: "docsFile", maxCount: 1 },
      ],
      { storage: PropertiesController.propertyStorage }
    )
  )
  @Patch(":id")
  update(
    @Req() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePropertyDto,
    @UploadedFiles()
    files: {
      frontImage?: Express.Multer.File[];
      roomsImage?: Express.Multer.File[];
      docsFile?: Express.Multer.File[];
    }
  ) {
    const frontImage = files?.frontImage?.[0]?.filename;
    const roomsImage = files?.roomsImage?.[0]?.filename;
    const docsFile = files?.docsFile?.[0]?.filename;

    return this.propertiesService.updateProperty(
      id,
      req.user.id,
      req.user.role,
      dto,
      { frontImage, roomsImage, docsFile }
    );
  }

  @ApiOperation({ summary: "Delete a property listing" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  remove(@Req() req, @Param("id", ParseIntPipe) id: number) {
    return this.propertiesService.deleteProperty(id, req.user.id, req.user.role);
  }

  @ApiOperation({ summary: "Promote / advertise a property listing" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Patch(":id/advertise")
  advertise(@Req() req, @Param("id", ParseIntPipe) id: number) {
    return this.propertiesService.advertiseProperty(
      id,
      req.user.id,
      req.user.role
    );
  }

  @ApiOperation({ summary: "Owner marks property as available, sold, or rented" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Patch(":id/status")
  updateOwnerStatus(
    @Req() req,
    @Param("id", ParseIntPipe) id: number,
    @Body("status") status: PropertyStatus
  ) {
    return this.propertiesService.updateOwnerPropertyStatus(id, req.user.id, status);
  }

  @ApiOperation({ summary: "Update status of a property lead/inquiry" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Patch("leads/:leadId")
  updateLeadStatus(
    @Req() req,
    @Param("leadId", ParseIntPipe) leadId: number,
    @Body("status") status: LeadStatus
  ) {
    return this.propertiesService.updateLeadStatus(leadId, req.user.id, status);
  }

  // =========================================================================
  // ADMIN APPROVAL / REJECTION ROUTES
  // =========================================================================

  @ApiOperation({ summary: "List all pending properties for review (Admin only)" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/pending")
  adminFindPending() {
    return this.propertiesService.adminFindPending();
  }

  @ApiOperation({ summary: "Approve a property listing (Admin only)" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("admin/:id/approve")
  adminApprove(@Param("id", ParseIntPipe) id: number) {
    return this.propertiesService.adminApprove(id);
  }

  @ApiOperation({ summary: "Reject a property listing (Admin only)" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("admin/:id/reject")
  adminReject(@Param("id", ParseIntPipe) id: number) {
    return this.propertiesService.adminReject(id);
  }
}
