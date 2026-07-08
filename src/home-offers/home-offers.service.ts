import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHomeOfferDto, UpdateHomeOfferDto } from "./dto/home-offer.dto";

@Injectable()
export class HomeOffersService {
  constructor(private prisma: PrismaService) {}

  getAdminOffers() {
    return this.prisma.homeOffer.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  getActiveOffers() {
    const now = new Date();
    return this.prisma.homeOffer.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 12,
    });
  }

  create(dto: CreateHomeOfferDto) {
    return this.prisma.homeOffer.create({ data: this.toData(dto) });
  }

  async update(id: number, dto: UpdateHomeOfferDto) {
    await this.ensureExists(id);
    return this.prisma.homeOffer.update({
      where: { id },
      data: this.toData(dto),
    });
  }

  async toggle(id: number) {
    const offer = await this.ensureExists(id);
    return this.prisma.homeOffer.update({
      where: { id },
      data: { isActive: !offer.isActive },
    });
  }

  async delete(id: number) {
    await this.ensureExists(id);
    return this.prisma.homeOffer.delete({ where: { id } });
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
