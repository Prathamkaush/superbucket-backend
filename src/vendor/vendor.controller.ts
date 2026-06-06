// vendor.controller.ts
import { Controller, Post, Get, Body, Param, Put } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';

@Controller('vendors')
export class VendorController {
  constructor(private vendorService: VendorService) {}

  @Post()
  create(@Body() createVendorDto: CreateVendorDto) {
    return this.vendorService.create(createVendorDto);
  }

  @Get()
  findAll() {
    return this.vendorService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateVendorDto: UpdateVendorDto) {
    return this.vendorService.update(+id, updateVendorDto);
  }
}