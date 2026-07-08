import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ServiceProviderStatus } from "@prisma/client";
import { AdminGuard } from "../auth/admin.guard";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import {
  CancelServiceBookingDto, CreateServiceBookingDto, CreateServiceCategoryDto,
  CreateServicePackageDto, ReviewServiceBookingDto, SetProviderAvailabilityDto,
  UpdateProviderApprovalDto, UpdateProviderJobStatusDto, UpdateServiceCategoryDto,
  UpdateServicePackageDto, UpsertProviderProfileDto,
} from "./dto/service-marketplace.dto";
import { ServicesMarketplaceService } from "./services-marketplace.service";

@Controller("services")
export class ServicesMarketplaceController {
  constructor(private readonly service: ServicesMarketplaceService) {}

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
  @Patch("bookings/:id/cancel")
  cancel(@Req() req, @Param("id", ParseIntPipe) id: number, @Body() dto: CancelServiceBookingDto) {
    return this.service.cancelBooking(req.user.id, id, dto);
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
  @Patch("provider/jobs/:id/accept")
  acceptJob(@Req() req, @Param("id", ParseIntPipe) id: number) {
    return this.service.acceptJob(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("provider/jobs/:id/status")
  updateJob(@Req() req, @Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProviderJobStatusDto) {
    return this.service.updateJobStatus(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/catalog")
  adminCatalog() { return this.service.getCatalog(true); }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("admin/categories")
  createCategory(@Body() dto: CreateServiceCategoryDto) { return this.service.createCategory(dto); }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("admin/categories/:id")
  updateCategory(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateServiceCategoryDto) {
    return this.service.updateCategory(id, dto);
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
  @Patch("admin/providers/:id/status")
  approveProvider(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProviderApprovalDto) {
    return this.service.updateProviderApproval(id, dto);
  }
}
