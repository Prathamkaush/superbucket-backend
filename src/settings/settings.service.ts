import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_DELIVERY_SLOT_TIMES = ["10:00 AM", "1:00 PM", "5:00 PM", "8:00 PM"];

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // Ensure there is always 1 row
  async getSettings() {
    let settings = await this.prisma.settings.findFirst();

    if (!settings) {
      settings = await this.prisma.settings.create({ data: {} });
    }

    return {
      ...settings,
      deliverySlotTimes: Array.isArray(settings.deliverySlotTimes)
        ? settings.deliverySlotTimes
        : DEFAULT_DELIVERY_SLOT_TIMES,
    };
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

    if (dto.deliverySlotTimes !== undefined) {
      const values = Array.isArray(dto.deliverySlotTimes)
        ? dto.deliverySlotTimes
        : String(dto.deliverySlotTimes || "")
            .split(",")
            .map((value) => value.trim());

      data.deliverySlotTimes = values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .slice(0, 8);
    }

    return this.prisma.settings.update({
      where: { id: await this.getSettingsId() },
      data,
    });
  }
}
