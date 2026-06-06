import { Module } from "@nestjs/common";
import { AttributesController } from "./attributes.controller";
import { AttributesService } from "./attributes.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AttributesController],
  providers: [AttributesService],
  exports: [AttributesService], // optional but good practice
})
export class AttributesModule {}
