import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Contrat front : cart.model.ts (AddToCartInput). */
export class AddToCartDto {
  @Type(() => Number)
  @IsInt()
  productId!: number;

  /** Produit simple : variantId == productId (accepté puis ignoré). */
  @Type(() => Number)
  @IsInt()
  variantId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qty!: number;
}

// --- Formes de sortie (cart.model.ts) ---

export interface CartLineView {
  id: number;
  productId: number;
  variantId: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  optionSummary: string | null;
  unitPriceCents: number;
  qty: number;
  lineTotalCents: number;
  maxQty: number;
  available: boolean;
}

export interface CartView {
  lines: CartLineView[];
  subtotalCents: number;
  itemCount: number;
}
