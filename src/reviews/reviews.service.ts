import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewStatus } from "@prisma/client";

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

    const deliveredOrder = await this.prisma.order.findFirst({
      where: {
        ...(dto.orderId ? { id: dto.orderId } : {}),
        userId,
        status: "DELIVERED",
        items: { some: { productId: dto.productId } },
      },
      orderBy: { deliveredAt: "desc" },
      select: { id: true },
    });

    if (!deliveredOrder) {
      throw new ForbiddenException("You can review this product after it has been delivered");
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
        order: { connect: { id: deliveredOrder.id } },
      },
    });
  }

  async getProductReviews(productId: number) {
    const reviews = await this.prisma.review.findMany({
      where: { productId, status: ReviewStatus.APPROVED },
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
      where: { status: ReviewStatus.APPROVED },
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
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 50);
    const skip = (safePage - 1) * safeLimit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        skip,
        take: safeLimit,
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
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(Math.ceil(total / safeLimit), 1),
    };
  }

  async updateStatus(id: number, status: ReviewStatus) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    return this.prisma.review.update({
      where: { id },
      data: { status },
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
}
