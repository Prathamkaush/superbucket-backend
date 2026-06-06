import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';

@Injectable()
export class ProductTypesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateProductTypeDto) {
    return this.prisma.productType.create({
      data: {
        name: dto.name,
        category: {
          connect: { id: dto.categoryId },
        },
      },
    });
  }

  async findAll(categoryId?: number) {
    return this.prisma.productType.findMany({
      where: categoryId ? { categoryId } : undefined,

      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: {
        id: "asc",
      },
    });
  }

  async findOne(id: number) {
    const type = await this.prisma.productType.findUnique({
      where: { id },
    });

    if (!type) {
      throw new NotFoundException('Product type not found');
    }

    return type;
  }

  async update(id: number, dto: UpdateProductTypeDto) {
    await this.findOne(id);

    return this.prisma.productType.update({
      where: { id },
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
      },
    });
  }

  async remove(id: number) {
    const type = await this.findOne(id);

    // ✅ Check for associated Product Subtypes
    const subtypesCount = await this.prisma.productSubtype.count({
      where: { typeId: id },
    });

    if (subtypesCount > 0) {
      throw new BadRequestException(
        `Cannot delete product type "${type.name}". It has ${subtypesCount} product subtype(s) associated with it. Please delete all product subtypes first.`
      );
    }

    // ✅ Check for associated Products
    const productsCount = await this.prisma.product.count({
      where: { typeId: id },
    });

    if (productsCount > 0) {
      throw new BadRequestException(
        `Cannot delete product type "${type.name}". It has ${productsCount} product(s) associated with it. Please delete or reassign all products first.`
      );
    }

    return this.prisma.productType.delete({
      where: { id },
    });
  }
}