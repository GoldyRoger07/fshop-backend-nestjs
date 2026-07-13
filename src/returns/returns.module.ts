import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReturnsService } from './returns.service';
import { OrderReturnsController, AdminReturnsController } from './returns.controller';
import { ReturnRequest } from './return-request.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReturnRequest, Order, OrderItem]), OrdersModule],
  controllers: [OrderReturnsController, AdminReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService], // dashboard stats
})
export class ReturnsModule {}
