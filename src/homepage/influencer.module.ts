import { Module } from "@nestjs/common";
import { InfluencerService } from "./influencer.service";
import { AdminInfluencerController } from "./admin-influencer.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PublicInfluencerController } from "./PublicInfluencer.controller";

@Module({
  imports: [PrismaModule],
  providers: [InfluencerService],
  controllers: [AdminInfluencerController , PublicInfluencerController ],
  exports: [InfluencerService], // 👈 VERY IMPORTANT
})
export class InfluencerModule {}
