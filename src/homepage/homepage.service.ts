import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHomepageSectionDto } from "./dto/create-section.dto";
import { UpdateHomepageSectionDto } from "./dto/update-section.dto";

@Injectable()
export class HomepageService {
  constructor(private prisma: PrismaService) {}

  /* ================= PUBLIC ================= */

   getActiveSections() {
    return this.prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      include: {
        influencerItems: {
          orderBy: { position: "asc" },
          include: {
            media: true,
            product: true,
          },
        },
      },
    });
  }

  /* ================= ADMIN ================= */

  getAllSections() {
    return this.prisma.homepageSection.findMany({
      orderBy: { position: "asc" },
    });
  }

 getOne(id: number) {
    return this.prisma.homepageSection.findUnique({
      where: { id },
      include: {
        influencerItems: {
          orderBy: { position: "asc" },
          include: {
            media: true,
            product: true,
          },
        },
      },
    });
  }

  async create(dto: CreateHomepageSectionDto) {
  // Create the section first
  const section = await this.prisma.homepageSection.create({
    data: {
      title: dto.title ?? "",
      type: dto.type,
      position: dto.position,
      isActive: dto.isActive ?? true,
      config: dto.config || {},
    },
  });

  // ✅ If it's an INFLUENCER section, create the items
  if (dto.type === "INFLUENCER" && dto.config?.items?.length > 0) {
    // Validate items
    this.validateInfluencerItems(dto.config.items);
    
    await this.prisma.influencerItem.createMany({
      data: dto.config.items.map((item: any) => ({
        homepageSectionId: section.id,
        mediaId: item.mediaId || null,
        embedUrl: item.embedUrl || null,
        productId: item.productId,
        influencerName: item.influencerName || null,
        ctaText: item.ctaText || "Shop Now",
        position: item.position,
      })),
    });
  }

  return section;
}

// Add this validation helper
private validateInfluencerItems(items: any[]) {
  for (const item of items) {
    // Must have either mediaId or embedUrl, not both
    if (!item.mediaId && !item.embedUrl) {
      throw new Error("Each influencer item must have either mediaId or embedUrl");
    }
    if (item.mediaId && item.embedUrl) {
      throw new Error("Each influencer item cannot have both mediaId and embedUrl");
    }
    // Must have productId
    if (!item.productId) {
      throw new Error("Each influencer item must have a productId");
    }
  }
}

async update(id: number, dto: UpdateHomepageSectionDto) {
  // First, get the existing section to know its type
  const existingSection = await this.prisma.homepageSection.findUnique({
    where: { id },
  });

  if (!existingSection) {
    throw new Error("Section not found");
  }

  // Determine the type (use DTO type if provided, otherwise use existing)
  const sectionType = dto.type ?? existingSection.type;

  // Update the section
  const section = await this.prisma.homepageSection.update({
    where: { id },
    data: {
      title: dto.title,
      type: dto.type,
      position: dto.position,
      isActive: dto.isActive,
      config: dto.config,
    },
  });

  // ✅ If it's an INFLUENCER section, sync the items
  if (sectionType === "INFLUENCER" && dto.config?.items) {
    // Delete existing items
    await this.prisma.influencerItem.deleteMany({
      where: { homepageSectionId: id },
    });

    // Create new items if any
    if (dto.config.items.length > 0) {
      await this.prisma.influencerItem.createMany({
        data: dto.config.items.map((item: any) => ({
          homepageSectionId: id,
          mediaId: item.mediaId || null,
          embedUrl: item.embedUrl || null,
          productId: item.productId,
          influencerName: item.influencerName || null,
          ctaText: item.ctaText || "Shop Now",
          position: item.position,
        })),
      });
    }
  }

  return section;
}

 async delete(id: number) {
  // First, delete all related influencer items
  await this.prisma.influencerItem.deleteMany({
    where: { homepageSectionId: id },
  });

  // Then delete the section
  return this.prisma.homepageSection.delete({
    where: { id },
  });
}

  async reorder(items: { id: number; position: number }[]) {
    const queries = items.map((item) =>
      this.prisma.homepageSection.update({
        where: { id: item.id },
        data: { position: item.position },
      })
    );

    await this.prisma.$transaction(queries);
    return { success: true };
  }

}
