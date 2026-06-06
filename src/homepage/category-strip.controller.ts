import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("category-strip")
export class CategoryStripController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async resolve(@Query("items") items: string) {
    /**
     * items = JSON string:
     * [
     *   { "subtypeId": 3, "mediaId": 11 },
     *   { "subtypeId": 5, "mediaId": 14 }
     * ]
     */

    if (!items) return [];

    const parsed: { subtypeId: number; mediaId?: number }[] =
      JSON.parse(items);

    const subtypeIds = parsed.map((i) => i.subtypeId);
    const mediaIds = parsed
      .map((i) => i.mediaId)
      .filter(Boolean) as number[];

    const [subtypes, media] = await Promise.all([
      this.prisma.productSubtype.findMany({
        where: { id: { in: subtypeIds } },
      }),
      mediaIds.length
        ? this.prisma.media.findMany({
            where: { id: { in: mediaIds } },
          })
        : Promise.resolve([]),
    ]);

    const mediaMap = new Map(media.map((m) => [m.id, m]));

    return parsed.map((item) => {
      const subtype = subtypes.find(
        (s) => s.id === item.subtypeId
      );
      const m = item.mediaId
        ? mediaMap.get(item.mediaId)
        : null;

      return {
        id: subtype?.id,
        name: subtype?.name,
        image: m ? `https://api.firstfemale.in${m.url}` : null,
      };
    });
  }
}
