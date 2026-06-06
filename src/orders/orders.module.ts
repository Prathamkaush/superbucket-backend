import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { CouponsModule } from "../coupons/coupons.module";

@Module({
  imports: [
    PrismaModule, // IMPORTANT
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '30d' },
    }),
    CouponsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    JwtAuthGuard,
    JwtStrategy,
  ],
  exports: [OrdersService],
})
export class OrdersModule {
  constructor() {
    console.log('✅ OrdersModule loaded');
  }
}
