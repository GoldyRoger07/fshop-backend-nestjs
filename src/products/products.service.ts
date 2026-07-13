import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { QueryProductDto } from './dto/query-product.dto';
import {
  ProductDetailDto,
  ProductSummaryDto,
  toProductDetail,
  toProductSummary,
} from './product.view';
import { Page, buildPage } from '../common/money';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  /** Catalogue public paginé (produits actifs uniquement). */
  async findAll(query: QueryProductDto): Promise<Page<ProductSummaryDto>> {
    const { category, q, sort = 'relevance', minPrice, maxPrice, inStock, page = 1, size = 12 } = query;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.category', 'category')
      .where('product.isActive = :active', { active: true });

    if (category) qb.andWhere('category.slug = :category', { category });
    if (q) qb.andWhere('(product.name LIKE :q OR product.description LIKE :q)', { q: `%${q}%` });
    if (minPrice !== undefined) qb.andWhere('product.priceCents >= :minPrice', { minPrice });
    if (maxPrice !== undefined) qb.andWhere('product.priceCents <= :maxPrice', { maxPrice });
    if (inStock) qb.andWhere('product.stock > 0');

    switch (sort) {
      case 'price_asc':
        qb.orderBy('product.priceCents', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('product.priceCents', 'DESC');
        break;
      case 'newest':
      case 'relevance':
      default:
        qb.orderBy('product.createdAt', 'DESC');
    }

    qb.skip((page - 1) * size).take(size);

    const [items, total] = await qb.getManyAndCount();
    return buildPage(items.map((p) => toProductSummary(p)), total, page, size);
  }

  /** Mise en avant accueil : produits actifs marqués `featured`, complétés par les plus récents. */
  async findFeatured(limit = 8): Promise<ProductSummaryDto[]> {
    const featured = await this.productRepo.find({
      where: { isActive: true, featured: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    if (featured.length >= limit) return featured.map((p) => toProductSummary(p));

    const recent = await this.productRepo.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    // Dédoublonne (featured d'abord), puis complète avec les récents.
    const seen = new Set(featured.map((p) => p.id));
    const merged = [...featured, ...recent.filter((p) => !seen.has(p.id))].slice(0, limit);
    return merged.map((p) => toProductSummary(p));
  }

  /** Fiche produit publique (par slug, active uniquement). */
  async findBySlug(slug: string): Promise<ProductDetailDto> {
    const product = await this.productRepo.findOne({
      where: { slug, isActive: true },
      relations: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Produit "${slug}" introuvable`);
    }
    return toProductDetail(product);
  }

  // --- Accès entité pour les autres modules (cart, checkout, admin) ---

  async findEntityById(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Produit ${id} introuvable`);
    }
    return product;
  }
}
