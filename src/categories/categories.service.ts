import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCategoryDto, image?: string) {
    return this.prisma.category.create({
      data: { name: dto.name, image: image ?? dto.image },
    });
  }

  findAll() {
    return this.prisma.category.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) throw new NotFoundException('Category not found');

    return category;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    const category = await this.findOne(id);

    // ✅ Check for associated Product Types
    const productTypesCount = await this.prisma.productType.count({
      where: { categoryId: id },
    });

    if (productTypesCount > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}". It has ${productTypesCount} product type(s) associated with it. Please delete or reassign all product types first.`
      );
    }

    // ✅ Check for associated Products
    const productsCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productsCount > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}". It has ${productsCount} product(s) associated with it. Please delete or reassign all products first.`
      );
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }
}
