import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { mkdirSync } from "fs";
import { extname, join } from "path";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { CreateHomeOfferDto, UpdateHomeOfferDto } from "./dto/home-offer.dto";
import { CreateBusinessAdDto } from "./dto/home-offer.dto";
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
    @Body() dto: CreateBusinessAdDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.homeOffersService.createBusinessAd(dto, image?.filename);
  }
}

@Controller("admin/home-offers")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminHomeOffersController {
  constructor(private readonly homeOffersService: HomeOffersService) {}

  @Get()
  getAll() {
    return this.homeOffersService.getAdminOffers();
  }

  @Post()
  create(@Body() dto: CreateHomeOfferDto) {
    return this.homeOffersService.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateHomeOfferDto
  ) {
    return this.homeOffersService.update(id, dto);
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
