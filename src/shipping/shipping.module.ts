import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingService } from './shipping.service';
import { ShippingZonesController, AdminShippingZonesController } from './shipping.controller';
import { ShippingZone } from './shipping-zone.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShippingZone])],
  controllers: [ShippingZonesController, AdminShippingZonesController],
  providers: [ShippingService],
  exports: [ShippingService], // le checkout résout la zone + le tarif
})
export class ShippingModule {}
