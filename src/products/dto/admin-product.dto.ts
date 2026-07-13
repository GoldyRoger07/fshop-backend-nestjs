import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Contrat front : admin-product.service.ts (CreateSimpleProductInput). */
export class CreateSimpleProductDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;

  @IsString() @IsNotEmpty() @MaxLength(220)
  slug!: string;

  @IsOptional() @IsString()
  description?: string;

  @Type(() => Number) @IsInt()
  categoryId!: number;

  @Type(() => Number) @IsInt() @Min(0)
  priceCents!: number;

  @Type(() => Number) @IsInt() @Min(0)
  stockQty!: number;

  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @IsBoolean()
  active!: boolean;
}

/** UpdateProductInput : métadonnées uniquement (prix/stock via variante). */
export class UpdateProductDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;

  @IsOptional() @IsString()
  description?: string;

  @Type(() => Number) @IsInt()
  categoryId!: number;

  @IsBoolean()
  active!: boolean;
}

/** UpdateVariantInput : prix/stock de la variante par défaut. */
export class UpdateVariantDto {
  @Type(() => Number) @IsInt() @Min(0)
  priceCents!: number;

  @Type(() => Number) @IsInt() @Min(0)
  stockQty!: number;
}
