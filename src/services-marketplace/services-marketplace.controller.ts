import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { basename, extname, join } from "path";
import type { Response } from "express";
import { ServiceProviderStatus } from "@prisma/client";
import { AdminGuard } from "../auth/admin.guard";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import {
  AcceptServiceRevisitDto, CancelServiceBookingDto, CreateServiceBookingDto,
  CreateServiceCategoryDto, CreateServiceExtensionDto, CreateServicePackageDto, RequestServiceRevisitDto,
  ReviewServiceBookingDto, SetProviderAvailabilityDto,
  UpdateProviderApprovalDto, UpdateProviderJobStatusDto, UpdateServiceCategoryDto,
  UpdateServicePackageDto, UpsertProviderProfileDto,
} from "./dto/service-marketplace.dto";
import { ServicesMarketplaceService } from "./services-marketplace.service";

@Controller("services")
export class ServicesMarketplaceController {
  constructor(private readonly service: ServicesMarketplaceService) {}

  private static categoryImageStorage = diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), "uploads", "services");
      mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, unique + extname(file.originalname).toLowerCase());
    },
  });

  private static categoryImageUpload = {
    storage: ServicesMarketplaceController.categoryImageStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
      if (!file.mimetype.startsWith("image/")) return cb(new BadRequestException("Only image files are allowed"), false);
      cb(null, true);
    },
  };

  private static extensionImageStorage = diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), "uploads", "service-extensions");
      mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, unique + extname(file.originalname).toLowerCase());
    },
  });

  private static extensionImageUpload = {
    storage: ServicesMarketplaceController.extensionImageStorage,
    limits: { fileSize: 10 * 1024 * 1024, files: 4 },
    fileFilter: (_req: any, file: Express.Multer.File, cb: any) => file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new BadRequestException("Only image files are allowed"), false),
  };

  @Get("images/:filename")
  categoryImage(@Param("filename") filename: string, @Res() response: Response) {
    const safeFilename = basename(filename);
    if (safeFilename !== filename) throw new BadRequestException("Invalid image filename");
    const filePath = join(process.cwd(), "uploads", "services", safeFilename);
    if (!existsSync(filePath)) throw new NotFoundException("Service image not found");
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return response.sendFile(filePath);
  }

  @Get("extension-images/:filename")
  extensionImage(@Param("filename") filename: string, @Res() response: Response) {
    const safeFilename = basename(filename);
    if (safeFilename !== filename) throw new BadRequestException("Invalid image filename");
    const filePath = join(process.cwd(), "uploads", "service-extensions", safeFilename);
    if (!existsSync(filePath)) throw new NotFoundException("Extension image not found");
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return response.sendFile(filePath);
  }

  @Get("catalog")
  catalog() { return this.service.getCatalog(); }

  @Get("providers")
  publicProviders(
    @Query("categoryId") categoryId?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "10",
  ) {
    return this.service.listPublicProviders({
      categoryId: categoryId ? Number(categoryId) : undefined,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("bookings")
  createBooking(@Req() req, @Body() dto: CreateServiceBookingDto) {
    return this.service.createBooking(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("bookings/my")
  myBookings(@Req() req) { return this.service.getCustomerBookings(req.user.id); }

  @UseGuards(JwtAuthGuard)
  @Get("bookings/:id")
  booking(@Req() req, @Param("id", ParseIntPipe) id: number) {
    return this.service.getCustomerBooking(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("bookings/:id/invoice")
  invoice(@Req() req, @Param("id", ParseIntPipe) id: number) {
    return this.service.getCustomerInvoice(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("bookings/:id/cancel")
  cancel(@Req() req, @Param("id", ParseIntPipe) id: number, @Body() dto: CancelServiceBookingDto) {
    return this.service.cancelBooking(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("bookings/:id/revisit/accept")
  acceptRevisit(@Req() req, @Param("id", ParseIntPipe) id: number, @Body() dto: AcceptServiceRevisitDto) {
    return this.service.acceptRevisit(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("bookings/:id/review")
  review(@Req() req, @Param("id", ParseIntPipe) id: number, @Body() dto: ReviewServiceBookingDto) {
    return this.service.reviewBooking(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("provider/profile")
  providerProfile(@Req() req) { return this.service.getProviderProfile(req.user.id); }

  @UseGuards(JwtAuthGuard)
  @Post("provider/profile")
  saveProviderProfile(@Req() req, @Body() dto: UpsertProviderProfileDto) {
    return this.service.upsertProviderProfile(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("provider/availability")
  availability(@Req() req, @Body() dto: SetProviderAvailabilityDto) {
    return this.service.setProviderAvailability(req.user.id, dto.isOnline);
  }

  @UseGuards(JwtAuthGuard)
  @Get("provider/jobs/available")
  availableJobs(@Req() req) { return this.service.getAvailableJobs(req.user.id); }

  @UseGuards(JwtAuthGuard)
  @Get("provider/jobs/my")
  providerJobs(@Req() req) { return this.service.getProviderJobs(req.user.id); }

  @UseGuards(JwtAuthGuard)
  @Get("provider/jobs/:id")
  providerJob(@Req() req, @Param("id", ParseIntPipe) id: number) {
    return this.service.getProviderJobDetails(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("provider/jobs/:id/extension")
  @UseInterceptors(FileFieldsInterceptor([
    { name: "problemImage1", maxCount: 1 },
    { name: "problemImage2", maxCount: 1 },
    { name: "solvedImage1", maxCount: 1 },
    { name: "solvedImage2", maxCount: 1 },
  ], ServicesMarketplaceController.extensionImageUpload))
  createExtension(
    @Req() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateServiceExtensionDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    return this.service.createServiceExtension(req.user.id, id, dto, files || {});
  }

  @UseGuards(JwtAuthGuard)
  @Patch("provider/jobs/:id/accept")
  acceptJob(@Req() req, @Param("id", ParseIntPipe) id: number) {
    return this.service.acceptJob(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("provider/jobs/:id/status")
  updateJob(@Req() req, @Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProviderJobStatusDto) {
    return this.service.updateJobStatus(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("provider/jobs/:id/revisit")
  requestRevisit(@Req() req, @Param("id", ParseIntPipe) id: number, @Body() dto: RequestServiceRevisitDto) {
    return this.service.requestRevisit(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/catalog")
  adminCatalog() { return this.service.getCatalog(true); }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("admin/categories")
  @UseInterceptors(FileInterceptor("image", ServicesMarketplaceController.categoryImageUpload))
  createCategory(@Body() dto: CreateServiceCategoryDto, @UploadedFile() image?: Express.Multer.File) {
    return this.service.createCategory(dto, image?.filename);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("admin/categories/:id")
  @UseInterceptors(FileInterceptor("image", ServicesMarketplaceController.categoryImageUpload))
  updateCategory(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateServiceCategoryDto, @UploadedFile() image?: Express.Multer.File) {
    return this.service.updateCategory(id, dto, image?.filename);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("admin/packages")
  createPackage(@Body() dto: CreateServicePackageDto) { return this.service.createPackage(dto); }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("admin/packages/:id")
  updatePackage(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateServicePackageDto) {
    return this.service.updatePackage(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/providers")
  providers(@Query("status") status?: ServiceProviderStatus) { return this.service.listProviders(status); }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/bookings")
  adminBookings() { return this.service.listBookingsForAdmin(); }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/extensions")
  adminExtensions() { return this.service.listExtensionsForAdmin(); }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("admin/providers/:id/status")
  approveProvider(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProviderApprovalDto) {
    return this.service.updateProviderApproval(id, dto);
  }
}
