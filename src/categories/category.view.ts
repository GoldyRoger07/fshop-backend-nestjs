import { Category } from './category.entity';

/** Forme catégorie attendue par le front (catalog.model.ts). */
export interface CategoryDto {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  position: number;
}

export function toCategoryDto(c: Category): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId ?? null,
    position: c.position ?? 0,
  };
}
