import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("media")
export class MediaController {
  constructor(private prisma: PrismaService) {}

  @Get()
  getByIds(@Query("ids") ids: string) {
    const mediaIds = ids
      .split(",")
      .map(Number)
      .filter(Boolean);

    return this.prisma.media.findMany({
      where: { id: { in: mediaIds } },
    });
  }
}
