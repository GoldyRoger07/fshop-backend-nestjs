import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingZone } from './shipping-zone.entity';
import { ShippingZoneInputDto } from './dto/shipping-zone.dto';

@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(ShippingZone)
    private readonly zoneRepo: Repository<ShippingZone>,
  ) {}

  listZones(activeOnly = false): Promise<ShippingZone[]> {
    return this.zoneRepo.find({
      where: activeOnly ? { active: true } : {},
      order: { name: 'ASC' },
    });
  }

  async findZone(id: number): Promise<ShippingZone> {
    const zone = await this.zoneRepo.findOne({ where: { id } });
    if (!zone) throw new NotFoundException(`Zone de livraison ${id} introuvable`);
    return zone;
  }

  create(input: ShippingZoneInputDto): Promise<ShippingZone> {
    return this.zoneRepo.save(this.zoneRepo.create(input));
  }

  async update(id: number, input: ShippingZoneInputDto): Promise<ShippingZone> {
    const zone = await this.findZone(id);
    Object.assign(zone, input);
    return this.zoneRepo.save(zone);
  }

  async remove(id: number): Promise<void> {
    const zone = await this.findZone(id);
    await this.zoneRepo.remove(zone);
  }
}
