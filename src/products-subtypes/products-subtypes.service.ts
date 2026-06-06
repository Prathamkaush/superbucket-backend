import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductSubtypeDto } from './dto/create-product-subtype.dto';
import { UpdateProductSubtypeDto } from './dto/update-product-subtype.dto';

@Injectable()
export class ProductSubtypesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateProductSubtypeDto) {
    return this.prisma.productSubtype.create({
      data: {
        name: dto.name,
        type: {
          connect: { id: dto.typeId },
        },
      },
    });
  }

  async findAll(typeId?: number) {
    return this.prisma.productSubtype.findMany({
      where: typeId ? { typeId } : undefined,

      include: {
        type: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        id: "asc",
      },
    });
  }

  async findOne(id: number) {
    const subtype = await this.prisma.productSubtype.findUnique({
      where: { id },
    });

    if (!subtype) {
      throw new NotFoundException('Product subtype not found');
    }

    return subtype;
  }

  async update(id: number, dto: UpdateProductSubtypeDto) {
    await this.findOne(id);

    return this.prisma.productSubtype.update({
      where: { id },
      data: {
        name: dto.name,
        typeId: dto.typeId,
      },
    });
  }

  async remove(id: number) {
    const subtype = await this.findOne(id);

    // ✅ Check for associated Products
    const productsCount = await this.prisma.product.count({
      where: { subtypeId: id },
    });

    if (productsCount > 0) {
      throw new BadRequestException(
        `Cannot delete product subtype "${subtype.name}". It has ${productsCount} product(s) associated with it. Please delete or reassign all products first.`
      );
    }

    return this.prisma.productSubtype.delete({
      where: { id },
    });
  }
  findAllWithType() {
  return this.prisma.productSubtype.findMany({
    select: {
      id: true,
      name: true,
      type: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}
}