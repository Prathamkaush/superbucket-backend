import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import slugify from "slugify";

@Injectable()
export class AttributesService {
  constructor(private prisma: PrismaService) {}

  /* ================= HELPERS ================= */

  private makeSlug(name: string) {
    return slugify(name, { lower: true, strict: true });
  }

  /* ================= READ ================= */

  getColors() {
    return this.prisma.color.findMany({ orderBy: { name: "asc" } });
  }

  getSeasons() {
    return this.prisma.season.findMany({ orderBy: { name: "asc" } });
  }

  getFabrics() {
    return this.prisma.fabric.findMany({ orderBy: { name: "asc" } });
  }

  getOccasions() {
    return this.prisma.occasion.findMany({ orderBy: { name: "asc" } });
  }

  getFits() {
    return this.prisma.fit.findMany({ orderBy: { name: "asc" } });
  }

  getSleeves() {
    return this.prisma.sleeve.findMany({ orderBy: { name: "asc" } });
  }

  getPatterns() {
    return this.prisma.pattern.findMany({ orderBy: { name: "asc" } });
  }

  /* ================= COLORS ================= */

  async createColor(data: { name: string; hex?: string }) {
    return this.prisma.color.create({
      data: {
        name: data.name,
        hex: data.hex,
        slug: this.makeSlug(data.name),
      },
    });
  }

  updateColor(id: number, data: { name?: string; hex?: string }) {
    return this.prisma.color.update({
      where: { id },
      data: {
        ...data,
        ...(data.name && { slug: this.makeSlug(data.name) }),
      },
    });
  }

  deleteColor(id: number) {
    return this.prisma.color.delete({ where: { id } });
  }

  /* ================= SEASONS ================= */

  createSeason(data: { name: string }) {
    return this.prisma.season.create({
      data: {
        name: data.name,
        slug: this.makeSlug(data.name),
      },
    });
  }

  updateSeason(id: number, data: { name?: string }) {
    return this.prisma.season.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name, slug: this.makeSlug(data.name) }),
      },
    });
  }

  deleteSeason(id: number) {
    return this.prisma.season.delete({ where: { id } });
  }

  /* ================= FABRICS ================= */

  createFabric(data: { name: string }) {
    return this.prisma.fabric.create({
      data: {
        name: data.name,
        slug: this.makeSlug(data.name),
      },
    });
  }

  updateFabric(id: number, data: { name?: string }) {
    return this.prisma.fabric.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name, slug: this.makeSlug(data.name) }),
      },
    });
  }

  deleteFabric(id: number) {
    return this.prisma.fabric.delete({ where: { id } });
  }

  /* ================= OCCASIONS ================= */

  createOccasion(data: { name: string }) {
    return this.prisma.occasion.create({
      data: {
        name: data.name,
        slug: this.makeSlug(data.name),
      },
    });
  }

  updateOccasion(id: number, data: { name?: string }) {
    return this.prisma.occasion.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name, slug: this.makeSlug(data.name) }),
      },
    });
  }

  deleteOccasion(id: number) {
    return this.prisma.occasion.delete({ where: { id } });
  }

  /* ================= FITS ================= */

  createFit(data: { name: string }) {
    return this.prisma.fit.create({
      data: {
        name: data.name,
        slug: this.makeSlug(data.name),
      },
    });
  }

  updateFit(id: number, data: { name?: string }) {
    return this.prisma.fit.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name, slug: this.makeSlug(data.name) }),
      },
    });
  }

  deleteFit(id: number) {
    return this.prisma.fit.delete({ where: { id } });
  }

  /* ================= SLEEVES ================= */

  createSleeve(data: { name: string }) {
    return this.prisma.sleeve.create({
      data: {
        name: data.name,
        slug: this.makeSlug(data.name),
      },
    });
  }

  updateSleeve(id: number, data: { name?: string }) {
    return this.prisma.sleeve.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name, slug: this.makeSlug(data.name) }),
      },
    });
  }

  deleteSleeve(id: number) {
    return this.prisma.sleeve.delete({ where: { id } });
  }

  /* ================= PATTERNS ================= */

  createPattern(data: { name: string }) {
    return this.prisma.pattern.create({
      data: {
        name: data.name,
        slug: this.makeSlug(data.name),
      },
    });
  }

  updatePattern(id: number, data: { name?: string }) {
    return this.prisma.pattern.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name, slug: this.makeSlug(data.name) }),
      },
    });
  }

  deletePattern(id: number) {
    return this.prisma.pattern.delete({ where: { id } });
  }
}
