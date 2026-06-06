import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { SmartBulkProductParser } from './utils/enhanced-bulk-product-parser.util';

@Module({
  imports: [AuthModule], // Add this
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService,  SmartBulkProductParser],
})
export class ProductsModule {}