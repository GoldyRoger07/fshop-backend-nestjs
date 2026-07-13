import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderItem } from './entities/order.entity';
import { OrdersService } from './orders.service';
import { CheckoutController } from './checkout.controller';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { ShippingModule } from '../shipping/shipping.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), ShippingModule],
  controllers: [CheckoutController, OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService], // le module retours transitionne les commandes
})
export class OrdersModule {}
