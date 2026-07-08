import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { CreateHomeOfferDto, UpdateHomeOfferDto } from "./dto/home-offer.dto";
import { HomeOffersService } from "./home-offers.service";

@Controller("home-offers")
export class PublicHomeOffersController {
  constructor(private readonly homeOffersService: HomeOffersService) {}

  @Get()
  getActive() {
    return this.homeOffersService.getActiveOffers();
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
