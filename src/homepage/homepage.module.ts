// homepage.module.ts
import { Module } from "@nestjs/common";
import { HomepageService } from "./homepage.service";
import { HomepageController } from "./homepage.controller";
import { AdminHomepageController } from "./admin-homepage.controller";
import { AdminMediaController } from "./AdminMedia.controller";
import { MediaController } from "./media.controller"; // ✅ ADD THIS
import { PrismaModule } from "../prisma/prisma.module";
import { CategoryStripController } from "./category-strip.controller";
import { AdminInfluencerController } from "./admin-influencer.controller";
import { InfluencerModule } from "./influencer.module";

@Module({
  imports: [PrismaModule, InfluencerModule],
  providers: [HomepageService],
  controllers: [
    HomepageController,
    AdminHomepageController,
    AdminMediaController, // admin only
    MediaController,
    CategoryStripController
  ],
})
export class HomepageModule {}
