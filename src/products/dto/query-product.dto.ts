import { IsOptional, IsInt, Min, Max, IsString, IsIn, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export type ProductSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

/** Filtres/tri/pagination catalogue (contrat front : catalog.model.ts ProductQuery). */
export class QueryProductDto {
  /** Slug de catégorie (param `category`). */
  @IsOptional()
  @IsString()
  category?: string;

  /** Recherche plein texte simple (param `q`). */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['relevance', 'price_asc', 'price_desc', 'newest'])
  sort?: ProductSort = 'relevance';

  /** Prix mini en centimes. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 12;
}
