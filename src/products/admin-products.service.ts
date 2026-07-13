import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductDetailDto, toProductDetail } from './product.view';
import {
  CreateSimpleProductDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/admin-product.dto';
import { CategoriesService } from '../categories/categories.service';

/** Ligne du tableau admin (admin.model.ts : AdminProductRow). */
export interface AdminProductRowView {
  id: number;
  name: string;
  slug: string;
  categoryName: string;
  priceCents: number;
  totalStock: number;
  hasVariants: boolean;
  active: boolean;
}

@Injectable()
export class AdminProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly categoriesService: CategoriesService,
  ) {}

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async list(): Promise<AdminProductRowView[]> {
    const products = await this.productRepo.find({
      relations: { category: true },
      order: { createdAt: 'DESC' },
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      categoryName: p.category?.name ?? '',
      priceCents: p.priceCents,
      totalStock: p.stock,
      hasVariants: false,
      active: p.isActive,
    }));
  }

  async get(id: number): Promise<ProductDetailDto> {
    return toProductDetail(await this.findEntity(id));
  }

  async create(dto: CreateSimpleProductDto): Promise<ProductDetailDto> {
    await this.categoriesService.findOne(dto.categoryId);
    const slug = this.slugify(dto.slug || dto.name);
    if (await this.productRepo.findOne({ where: { slug } })) {
      throw new ConflictException(`Le slug "${slug}" est déjà utilisé`);
    }
    const product = this.productRepo.create({
      name: dto.name,
      slug,
      description: dto.description ?? null,
      priceCents: dto.priceCents,
      stock: dto.stockQty,
      imageUrl: dto.imageUrl ?? null,
      isActive: dto.active,
      categoryId: dto.categoryId,
    });
    const saved = await this.productRepo.save(product);
    return this.get(saved.id);
  }

  async update(id: number, dto: UpdateProductDto): Promise<ProductDetailDto> {
    const product = await this.findEntity(id);
    if (dto.categoryId !== product.categoryId) {
      await this.categoriesService.findOne(dto.categoryId);
    }
    product.name = dto.name;
    product.description = dto.description ?? null;
    product.categoryId = dto.categoryId;
    product.isActive = dto.active;
    await this.productRepo.save(product);
    return this.get(id);
  }

  /** Produit simple : la variante par défaut porte l'id du produit. */
  async updateVariant(
    productId: number,
    variantId: number,
    dto: UpdateVariantDto,
  ): Promise<ProductDetailDto> {
    if (variantId !== productId) {
      throw new BadRequestException('Variante inconnue pour ce produit');
    }
    const product = await this.findEntity(productId);
    product.priceCents = dto.priceCents;
    product.stock = dto.stockQty;
    await this.productRepo.save(product);
    return this.get(productId);
  }

  /** Suppression douce (SPEC §6) : désactivation. */
  async remove(id: number): Promise<void> {
    const product = await this.findEntity(id);
    product.isActive = false;
    await this.productRepo.save(product);
  }

  private async findEntity(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!product) throw new NotFoundException(`Produit ${id} introuvable`);
    return product;
  }
}
