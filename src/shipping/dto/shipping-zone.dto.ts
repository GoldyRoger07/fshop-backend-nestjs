import { IsString, IsNotEmpty, MaxLength, IsInt, Min, IsBoolean, IsOptional } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ShippingZoneInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  feeCents!: number;

  @IsBoolean()
  active!: boolean;
}

export class ListZonesQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  activeOnly?: boolean;
}
