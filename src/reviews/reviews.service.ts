import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReviewDto } from "./dto/create-review.dto";

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(userId: number, dto: CreateReviewDto) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: dto.productId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    let orderId: number | null = null;

    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: {
          id: dto.orderId,
          userId,
          items: {
            some: {
              productId: dto.productId,
            },
          },
        },
        select: { id: true },
      });

      if (!order) {
        throw new ForbiddenException("Product not in this order");
      }

      orderId = order.id;
    }

    const exists = await this.prisma.review.findFirst({
      where: {
        userId,
        productId: dto.productId,
      },
    });

    if (exists) {
      throw new BadRequestException("Review already submitted");
    }

    return this.prisma.review.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        user: { connect: { id: userId } },
        product: { connect: { id: dto.productId } },
        ...(orderId ? { order: { connect: { id: orderId } } } : {}),
      },
    });
  }

  async getProductReviews(productId: number) {
    const reviews = await this.prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const avg =
      reviews.reduce((sum, review) => sum + review.rating, 0) /
      (reviews.length || 1);

    return {
      averageRating: Number(avg.toFixed(1)),
      total: reviews.length,
      reviews,
    };
  }

  getAll() {
    return this.prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, email: true },
        },
        product: {
          select: { id: true, title: true },
        },
      },
    });
  }

  getLatest(limit = 4) {
    return this.prisma.review.findMany({
      take: Math.min(Math.max(Number(limit) || 4, 1), 12),
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true },
        },
        product: {
          select: { id: true, title: true, slug: true, img1: true },
        },
      },
    });
  }

  async getAllPaginated(page = 1, limit = 5) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { name: true, email: true },
          },
          product: {
            select: { id: true, title: true },
          },
        },
      }),
      this.prisma.review.count(),
    ]);

    return {
      data: reviews,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }
}
