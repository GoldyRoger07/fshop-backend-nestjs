import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingZoneInputDto, ListZonesQueryDto } from './dto/shipping-zone.dto';
import { toShippingZoneView } from './shipping-zone.entity';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/** Lecture publique des zones (utilisée au checkout). */
@Controller('shipping-zones')
export class ShippingZonesController {
  constructor(private readonly shippingService: ShippingService) {}

  @Public()
  @Get()
  async list(@Query() query: ListZonesQueryDto) {
    const zones = await this.shippingService.listZones(query.activeOnly ?? false);
    return zones.map(toShippingZoneView);
  }
}

/** Gestion admin des zones (SPEC §12). */
@Controller('admin/shipping-zones')
export class AdminShippingZonesController {
  constructor(private readonly shippingService: ShippingService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() input: ShippingZoneInputDto) {
    return toShippingZoneView(await this.shippingService.create(input));
  }

  @Roles(UserRole.ADMIN)
  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: ShippingZoneInputDto) {
    return toShippingZoneView(await this.shippingService.update(id, input));
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.shippingService.remove(id);
  }
}
