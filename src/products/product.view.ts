import { Product } from './entities/product.entity';
import { CategoryDto, toCategoryDto } from '../categories/category.view';

/**
 * Mappers entité → « vue produit uniforme » du front (catalog.model.ts).
 * Produit simple = une seule variante par défaut dont l'`id` = `product.id`.
 */

export interface ProductImageDto {
  url: string;
  alt: string;
  position: number;
  isPrimary: boolean;
}

export interface ProductVariantDto {
  id: number;
  sku: string;
  priceCents: number;
  stockQty: number;
  optionValueIds: number[];
}

export interface ProductSummaryDto {
  id: number;
  name: string;
  slug: string;
  priceCents: number;
  primaryImage: ProductImageDto | null;
  ratingAvg: number | null;
  reviewCount: number;
  inStock: boolean;
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string;
  category: CategoryDto;
  active: boolean;
  hasVariants: boolean;
  images: ProductImageDto[];
  options: [];
  variants: ProductVariantDto[];
}

/** Agrégats d'avis approuvés, injectés par le service (0/null si aucun). */
export interface RatingAgg {
  ratingAvg: number | null;
  reviewCount: number;
}

function primaryImage(p: Product): ProductImageDto | null {
  if (!p.imageUrl) return null;
  return { url: p.imageUrl, alt: p.name, position: 0, isPrimary: true };
}

export function toProductSummary(p: Product, rating?: RatingAgg): ProductSummaryDto {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    priceCents: p.priceCents,
    primaryImage: primaryImage(p),
    ratingAvg: rating?.ratingAvg ?? null,
    reviewCount: rating?.reviewCount ?? 0,
    inStock: p.stock > 0,
  };
}

export function toProductDetail(p: Product, rating?: RatingAgg): ProductDetailDto {
  const img = primaryImage(p);
  return {
    ...toProductSummary(p, rating),
    description: p.description ?? '',
    category: toCategoryDto(p.category),
    active: p.isActive,
    hasVariants: false,
    images: img ? [img] : [],
    options: [],
    variants: [
      {
        id: p.id, // variante par défaut : même id que le produit
        sku: p.slug,
        priceCents: p.priceCents,
        stockQty: p.stock,
        optionValueIds: [],
      },
    ],
  };
}
