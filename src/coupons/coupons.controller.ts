import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
  Patch,
} from "@nestjs/common";
import { CouponsService } from "./coupons.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";

import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { ValidateCouponDto } from "./dto/validate-coupon.dto";
import { AuthRequest } from "../auth/auth-request.interface";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@Controller("admin/coupons")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.createCoupon(dto);
  }

  @Get()
  findAll() {
    return this.couponsService.getAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.couponsService.getById(id);
  }
@Patch(":id")
update(
  @Param("id", ParseIntPipe) id: number,
  @Body() dto: UpdateCouponDto
) {
  return this.couponsService.updateCoupon(id, dto);
}
  @Put(":id/toggle")
  toggle(@Param("id", ParseIntPipe) id: number) {
    return this.couponsService.toggleCoupon(id);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.couponsService.deleteCoupon(id);
  }
}
@Controller("coupons")
export class CouponsPublicController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get("available")
  getAvailableCoupons() {
    return this.couponsService.getAvailableCoupons();
  }

  @Post("validate")
  @UseGuards(JwtAuthGuard)
  validate(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validateCoupon(dto);
  }
}