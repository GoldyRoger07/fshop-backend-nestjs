import { ValueTransformer } from 'typeorm';

/**
 * Montants en **centimes de HTG** (SPEC §4.1). Colonnes MySQL en BIGINT ;
 * mysql2 renvoie les BIGINT en `string` → on reconvertit en `number` (les
 * montants tiennent dans la plage sûre 2^53).
 */
export const bigintTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseInt(value, 10),
};

/** Enveloppe de pagination attendue par le front (`api.model.ts`). */
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export function buildPage<T>(
  items: T[],
  total: number,
  page: number,
  size: number,
): Page<T> {
  return {
    items,
    page,
    size,
    total,
    totalPages: size > 0 ? Math.ceil(total / size) : 0,
  };
}
