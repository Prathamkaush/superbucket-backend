// vendor.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';

@Injectable()
export class VendorService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateVendorDto) {
    const existingVendor = await this.prisma.vendor.findUnique({
      where: { emailId: dto.emailId },
    });

    if (existingVendor) {
      throw new BadRequestException('Vendor with this email already exists');
    }

    return this.prisma.vendor.create({
      data: {
        companyName: dto.companyName,
        contactPersonName: dto.contactPersonName,
        contactNumber: dto.contactNumber,
        emailId: dto.emailId,
        gstNumber: dto.gstNumber,
        address: dto.address,
        vendorType: dto.vendorType,
      },
    });
  }

  async findAll() {
    return this.prisma.vendor.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.vendor.findUnique({
      where: { id },
      include: { productVendors: true },
    });
  }

  async update(id: number, dto: UpdateVendorDto) {
    return this.prisma.vendor.update({
      where: { id },
      data: dto,
    });
  }
}