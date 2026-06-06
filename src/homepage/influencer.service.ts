import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InfluencerService {
  constructor(private prisma: PrismaService) {}

  async addItem(
    sectionId: number,
    dto: {
      mediaId?: number;
      embedUrl?: string;
      productId: number;
      influencerName?: string;
      ctaText?: string;
      position: number;
    }
  ) {
    // ✅ Validation
    if (!dto.embedUrl && !dto.mediaId) {
      throw new BadRequestException(
        "Either embedUrl (Instagram) or mediaId (Upload) is required"
      );
    }

    if (dto.embedUrl && dto.mediaId) {
      throw new BadRequestException(
        "Provide either embedUrl or mediaId, not both"
      );
    }

    return this.prisma.influencerItem.create({
      data: {
        homepageSectionId: sectionId,
        mediaId: dto.mediaId || null,
        embedUrl: dto.embedUrl || null,
        mediaType: dto.embedUrl ? "INSTAGRAM" : "UPLOAD",
        productId: dto.productId,
        influencerName: dto.influencerName || null,
        ctaText: dto.ctaText || "Shop Now",
        position: dto.position,
      },
      include: {
        media: true,
        product: {
          include: {
            sizes: true,
          },
        },
      },
    });
  }

  async updateItem(
    id: number,
    dto: {
      mediaId?: number;
      embedUrl?: string;
      productId?: number;
      influencerName?: string;
      ctaText?: string;
      position?: number;
    }
  ) {
    if (dto.embedUrl && dto.mediaId) {
      throw new BadRequestException(
        "Provide either embedUrl or mediaId, not both"
      );
    }

    return this.prisma.influencerItem.update({
      where: { id },
      data: {
         mediaId: dto.mediaId ?? null,
        embedUrl: dto.embedUrl ?? null,
        mediaType: dto.embedUrl ? "INSTAGRAM" : "UPLOAD",
        productId: dto.productId,
        influencerName: dto.influencerName,
        ctaText: dto.ctaText,
        position: dto.position,
      },
      include: {
        media: true,
        product: {
          include: {
            sizes: true,
          },
        },
      },
    });
  }

  async deleteItem(id: number) {
    return this.prisma.influencerItem.delete({
      where: { id },
    });
  }

  async reorder(items: { id: number; position: number }[]) {
    return this.prisma.$transaction(
      items.map((item) =>
        this.prisma.influencerItem.update({
          where: { id: item.id },
          data: { position: item.position },
        })
      )
    );
  }

  async getItemsBySection(sectionId: number) {
    return this.prisma.influencerItem.findMany({
      where: { homepageSectionId: sectionId },
      include: {
        media: true,
        product: {
          include: {
            sizes: true,
          },
        },
      },
      orderBy: { position: "asc" },
    });
  }

  async bulkSync(
  sectionId: number,
  items: Array<{
    mediaId?: number;
    embedUrl?: string;
    productId: number;
    influencerName?: string;
    ctaText?: string;
    position: number;
  }>
) {
  // ✅ Validate each item
  for (const item of items) {
    if (!item.embedUrl && !item.mediaId) {
      throw new BadRequestException(
        "Each item must have either embedUrl or mediaId"
      );
    }
    if (item.embedUrl && item.mediaId) {
      throw new BadRequestException(
        "Each item cannot have both embedUrl and mediaId"
      );
    }
  }

  await this.prisma.influencerItem.deleteMany({
    where: { homepageSectionId: sectionId },
  });

  if (!items.length) return { count: 0 };

  return this.prisma.influencerItem.createMany({
    data: items.map((item) => ({
      homepageSectionId: sectionId,
      mediaId: item.mediaId || null,
      embedUrl: item.embedUrl || null,
      mediaType: item.embedUrl ? "INSTAGRAM" : "UPLOAD",
      productId: item.productId,
      influencerName: item.influencerName || null,
      ctaText: item.ctaText || "Shop Now",
      position: item.position,
    })),
  });
}
}
