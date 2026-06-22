import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ServicesMarketplaceController } from "./services-marketplace.controller";
import { ServicesMarketplaceService } from "./services-marketplace.service";

@Module({
  imports: [PrismaModule],
  controllers: [ServicesMarketplaceController],
  providers: [ServicesMarketplaceService],
  exports: [ServicesMarketplaceService],
})
export class ServicesMarketplaceModule {}
