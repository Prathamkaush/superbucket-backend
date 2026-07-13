import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { basename, extname, join } from "path";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import {
  CreateBusinessAdDto,
  CreateBusinessAdPlanDto,
  CreateHomeOfferDto,
  ReviewBusinessAdDto,
  UpdateBusinessAdDto,
  UpdateBusinessAdPlanDto,
  UpdateHomeOfferDto,
  VerifyBusinessAdPaymentDto,
} from "./dto/home-offer.dto";
import { HomeOffersService } from "./home-offers.service";

@Controller("home-offers")
export class PublicHomeOffersController {
  constructor(private readonly homeOffersService: HomeOffersService) {}

  private static posterStorage = diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), "uploads", "business-ads");
      mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, unique + extname(file.originalname).toLowerCase());
    },
  });

  @Get()
  getActive() {
    return this.homeOffersService.getActiveOffers();
  }

  @Get("business-ad-plans")
  getBusinessAdPlans() {
    return this.homeOffersService.getActiveAdPlans();
  }

  @Get("business-ads/my")
  @UseGuards(JwtAuthGuard)
  getMyBusinessAds(@Req() req: any) {
    return this.homeOffersService.getMyBusinessAds(req.user.id);
  }

  @Get("images/:filename")
  getOfferImage(@Param("filename") filename: string, @Res() response: Response) {
    const safeFilename = basename(filename);
    if (safeFilename !== filename) throw new BadRequestException("Invalid image filename");
    const filePath = join(process.cwd(), "uploads", "home-offers", safeFilename);
    if (!existsSync(filePath)) throw new NotFoundException("Offer image not found");
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return response.sendFile(filePath);
  }

  @Post("advertise-business")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("image", {
    storage: PublicHomeOffersController.posterStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        return cb(new BadRequestException("Only image files are allowed"), false);
      }
      cb(null, true);
    },
  }))
  createBusinessAd(
    @Req() req: any,
    @Body() dto: CreateBusinessAdDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.homeOffersService.createBusinessAd(req.user.id, dto, image?.filename);
  }

  @Patch("business-ads/:id")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("image", {
    storage: PublicHomeOffersController.posterStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new BadRequestException("Only image files are allowed"), false),
  }))
  updateMyBusinessAd(@Req() req: any, @Param("id", ParseIntPipe) id: number, @Body() dto: UpdateBusinessAdDto, @UploadedFile() image?: Express.Multer.File) {
    return this.homeOffersService.updateMyBusinessAd(req.user.id, id, dto, image?.filename);
  }

  @Delete("business-ads/:id")
  @UseGuards(JwtAuthGuard)
  archiveMyBusinessAd(@Req() req: any, @Param("id", ParseIntPipe) id: number) {
    return this.homeOffersService.archiveMyBusinessAd(req.user.id, id);
  }

  @Post("business-ads/:id/pay/wallet")
  @UseGuards(JwtAuthGuard)
  payBusinessAdWithWallet(@Req() req: any, @Param("id", ParseIntPipe) id: number) {
    return this.homeOffersService.payBusinessAdWithWallet(req.user.id, id);
  }

  @Post("business-ads/:id/pay/razorpay/create")
  @UseGuards(JwtAuthGuard)
  createBusinessAdPayment(@Req() req: any, @Param("id", ParseIntPipe) id: number) {
    return this.homeOffersService.createBusinessAdRazorpayOrder(req.user.id, id);
  }

  @Post("business-ads/:id/pay/razorpay/verify")
  @UseGuards(JwtAuthGuard)
  verifyBusinessAdPayment(@Req() req: any, @Param("id", ParseIntPipe) id: number, @Body() dto: VerifyBusinessAdPaymentDto) {
    return this.homeOffersService.verifyBusinessAdRazorpayPayment(req.user.id, id, dto);
  }

  @Post("business-ads/:id/click")
  registerBusinessAdClick(@Param("id", ParseIntPipe) id: number) {
    return this.homeOffersService.registerBusinessAdClick(id);
  }
}

@Controller("admin/home-offers")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminHomeOffersController {
  constructor(private readonly homeOffersService: HomeOffersService) {}

  private static imageStorage = diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), "uploads", "home-offers");
      mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, unique + extname(file.originalname).toLowerCase());
    },
  });

  private static imageUpload = {
    storage: AdminHomeOffersController.imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
      if (!file.mimetype.startsWith("image/")) return cb(new BadRequestException("Only image files are allowed"), false);
      cb(null, true);
    },
  };

  @Get()
  getAll() {
    return this.homeOffersService.getAdminOffers();
  }

  @Get("business-ads/campaigns")
  getBusinessAds() {
    return this.homeOffersService.getAdminBusinessAds();
  }

  @Patch("business-ads/campaigns/:id/review")
  reviewBusinessAd(@Param("id", ParseIntPipe) id: number, @Body() dto: ReviewBusinessAdDto) {
    return this.homeOffersService.reviewBusinessAd(id, dto);
  }

  @Put("business-ads/campaigns/:id/pause")
  toggleBusinessAdPause(@Param("id", ParseIntPipe) id: number) {
    return this.homeOffersService.toggleBusinessAdPause(id);
  }

  @Delete("business-ads/campaigns/:id")
  archiveBusinessAd(@Param("id", ParseIntPipe) id: number) {
    return this.homeOffersService.archiveAdminBusinessAd(id);
  }

  @Get("business-ad-plans")
  getBusinessAdPlans() {
    return this.homeOffersService.getAdminAdPlans();
  }

  @Post("business-ad-plans")
  createBusinessAdPlan(@Body() dto: CreateBusinessAdPlanDto) {
    return this.homeOffersService.createAdPlan(dto);
  }

  @Patch("business-ad-plans/:id")
  updateBusinessAdPlan(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateBusinessAdPlanDto) {
    return this.homeOffersService.updateAdPlan(id, dto);
  }

  @Post()
  @UseInterceptors(FileInterceptor("image", AdminHomeOffersController.imageUpload))
  create(@Body() dto: CreateHomeOfferDto, @UploadedFile() image?: Express.Multer.File) {
    return this.homeOffersService.create(dto, image?.filename);
  }

  @Patch(":id")
  @UseInterceptors(FileInterceptor("image", AdminHomeOffersController.imageUpload))
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateHomeOfferDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.homeOffersService.update(id, dto, image?.filename);
  }

  @Put(":id/toggle")
  toggle(@Param("id", ParseIntPipe) id: number) {
    return this.homeOffersService.toggle(id);
  }

  @Delete(":id")
  delete(@Param("id", ParseIntPipe) id: number) {
    return this.homeOffersService.delete(id);
  }
}
