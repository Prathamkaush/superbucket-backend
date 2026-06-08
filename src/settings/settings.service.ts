import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // Ensure there is always 1 row
  async getSettings() {
    let settings = await this.prisma.settings.findFirst();

    if (!settings) {
      settings = await this.prisma.settings.create({ data: {} });
    }

    return settings;
  }

  private async getSettingsId() {
    const settings = await this.getSettings();
    return settings.id;
  }

  async updateProfile(dto: any) {
    return this.prisma.settings.update({
      where: { id: await this.getSettingsId() },
      data: {
        name: dto.name || null,
        email: dto.email || null,
      },
    });
  }

  async updateStore(dto: any, file?: Express.Multer.File) {
    const data: any = {
      supportEmail: dto.supportEmail || null,
      supportPhone: dto.supportPhone || null,
      address: dto.address || null,
    };

    if (dto.storeName !== undefined) {
      data.storeName = dto.storeName || null;
    }

    if (file) {
      data.logo = file.filename;
    }

    return this.prisma.settings.update({
      where: { id: await this.getSettingsId() },
      data,
    });
  }

  async updateGeneral(dto: any) {
    const data: any = {};

    if (dto.currency !== undefined) {
      data.currency = dto.currency || "INR";
    }

    if (dto.maintenanceMode !== undefined) {
      data.maintenanceMode =
        dto.maintenanceMode === true || dto.maintenanceMode === "true";
    }

    return this.prisma.settings.update({
      where: { id: await this.getSettingsId() },
      data,
    });
  }
}
