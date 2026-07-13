import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsService } from './stats.service';
import { AdminStatsController } from './stats.controller';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { ReviewsModule } from '../reviews/reviews.module';
import { ReturnsModule } from '../returns/returns.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product]),
    ReviewsModule,
    ReturnsModule,
  ],
  controllers: [AdminStatsController],
  providers: [StatsService],
})
export class StatsModule {}
