import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateBusinessAdDto,
  CreateHomeOfferDto,
  UpdateHomeOfferDto,
} from "./dto/home-offer.dto";
import { AppCacheService } from "../cache/app-cache.service";

@Injectable()
export class HomeOffersService {
  constructor(
    private prisma: PrismaService,
    private cache: AppCacheService,
  ) {}

  getAdminOffers() {
    return this.prisma.homeOffer.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  getActiveOffers() {
    const now = new Date();

    return this.cache.getOrSet("home-offers:active", 60, () =>
      this.prisma.homeOffer.findMany({
        where: {
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 12,
      }),
    );
  }

  async create(dto: CreateHomeOfferDto) {
    const offer = await this.prisma.homeOffer.create({ data: this.toData(dto) });
    await this.clearCache();
    return offer;
  }

  async createBusinessAd(dto: CreateBusinessAdDto) {
    const businessName = dto.businessName.trim();
    const offerText = dto.offer?.trim();
    const description = dto.description.trim();
    const category = dto.category?.trim();
    const phone = dto.phone.replace(/\D/g, "").slice(0, 10);

    const offer = await this.prisma.homeOffer.create({
      data: {
        title: businessName,
        subtitle: offerText || description,
        buttonLabel: phone ? `Call ${phone}` : "Visit",
        code: category || null,
        icon: "business",
        color: "#0B63CE",
        imageUrl: dto.posterUrl?.trim() || null,
        sortOrder: -10,
        isActive: true,
        startsAt: new Date(),
        expiresAt: null,
      },
    });
    await this.clearCache();
    return offer;
  }

  async update(id: number, dto: UpdateHomeOfferDto) {
    await this.ensureExists(id);
    const offer = await this.prisma.homeOffer.update({
      where: { id },
      data: this.toData(dto),
    });
    await this.clearCache();
    return offer;
  }

  async toggle(id: number) {
    const offer = await this.ensureExists(id);
    const updated = await this.prisma.homeOffer.update({
      where: { id },
      data: { isActive: !offer.isActive },
    });
    await this.clearCache();
    return updated;
  }

  async delete(id: number) {
    await this.ensureExists(id);
    const deleted = await this.prisma.homeOffer.delete({ where: { id } });
    await this.clearCache();
    return deleted;
  }

  private clearCache() {
    return this.cache.deleteByPrefix("home-offers:");
  }

  private async ensureExists(id: number) {
    const offer = await this.prisma.homeOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException("Offer not found");
    return offer;
  }

  private toData(dto: CreateHomeOfferDto | UpdateHomeOfferDto) {
    return {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.subtitle !== undefined && { subtitle: dto.subtitle.trim() }),
      ...(dto.buttonLabel !== undefined && {
        buttonLabel: dto.buttonLabel?.trim() || "Claim",
      }),
      ...(dto.code !== undefined && { code: dto.code?.trim() || null }),
      ...(dto.icon !== undefined && { icon: dto.icon?.trim() || "tag" }),
      ...(dto.color !== undefined && { color: dto.color?.trim() || "#E30613" }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl?.trim() || null }),
      ...(dto.sortOrder !== undefined && { sortOrder: Number(dto.sortOrder) || 0 }),
      ...(dto.isActive !== undefined && { isActive: Boolean(dto.isActive) }),
      ...(dto.startsAt !== undefined && {
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      }),
      ...(dto.expiresAt !== undefined && {
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    };
  }
}
