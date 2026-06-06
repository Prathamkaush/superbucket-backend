import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
} from "@nestjs/common";
import { AddressesService } from "./addresses.service";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";

@Controller("addresses")
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly service: AddressesService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateAddressDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.id);
  }

  @Get(":id")
  findOne(
    @Req() req: any,
    @Param("id", ParseIntPipe) id: number
  ) {
    return this.service.findOne(id, req.user.id);
  }

  @Put(":id")
  update(
    @Req() req: any,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto
  ) {
    return this.service.update(id, req.user.id, dto);
  }

  @Put(":id/default")
  setDefault(
    @Req() req: any,
    @Param("id", ParseIntPipe) id: number
  ) {
    return this.service.setDefault(id, req.user.id);
  }

  @Delete(":id")
  remove(
    @Req() req: any,
    @Param("id", ParseIntPipe) id: number
  ) {
    return this.service.remove(id, req.user.id);
  }
}
