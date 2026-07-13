import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { AddToCartDto, CartLineView, CartView } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartRepo: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  /** Panier recalculé au prix/stock courant (SPEC §7). */
  async getCart(userId: number): Promise<CartView> {
    const items = await this.cartRepo.find({
      where: { userId },
      relations: { product: true },
      order: { createdAt: 'ASC' },
    });
    return this.buildCart(items);
  }

  async addItem(userId: number, dto: AddToCartDto): Promise<CartView> {
    const product = await this.productRepo.findOne({ where: { id: dto.productId } });
    if (!product || !product.isActive) {
      throw new NotFoundException('Produit indisponible');
    }
    if (product.stock <= 0) {
      throw new BadRequestException('Produit en rupture de stock');
    }

    const item = await this.cartRepo.findOne({ where: { userId, productId: dto.productId } });
    const desired = (item?.qty ?? 0) + dto.qty;
    const qty = Math.min(desired, product.stock); // clamp au stock (SPEC §7)

    if (item) {
      item.qty = qty;
      await this.cartRepo.save(item);
    } else {
      await this.cartRepo.save(this.cartRepo.create({ userId, productId: dto.productId, qty }));
    }
    return this.getCart(userId);
  }

  async updateQty(userId: number, lineId: number, qty: number): Promise<CartView> {
    const item = await this.cartRepo.findOne({
      where: { id: lineId, userId },
      relations: { product: true },
    });
    if (!item) throw new NotFoundException('Ligne de panier introuvable');

    if (qty <= 0) {
      await this.cartRepo.remove(item);
      return this.getCart(userId);
    }
    // Clamp au stock disponible (SPEC §7 : clamp + message côté front via maxQty).
    item.qty = item.product.stock > 0 ? Math.min(qty, item.product.stock) : qty;
    await this.cartRepo.save(item);
    return this.getCart(userId);
  }

  async removeItem(userId: number, lineId: number): Promise<CartView> {
    const item = await this.cartRepo.findOne({ where: { id: lineId, userId } });
    if (!item) throw new NotFoundException('Ligne de panier introuvable');
    await this.cartRepo.remove(item);
    return this.getCart(userId);
  }

  async clear(userId: number): Promise<CartView> {
    await this.cartRepo.delete({ userId });
    return this.getCart(userId);
  }

  private buildCart(items: CartItem[]): CartView {
    const lines: CartLineView[] = items.map((it) => {
      const p = it.product;
      const available = p.isActive && p.stock > 0;
      const qty = available ? Math.min(it.qty, p.stock) : it.qty;
      return {
        id: it.id,
        productId: p.id,
        variantId: p.id, // produit simple : variante par défaut
        slug: p.slug,
        name: p.name,
        imageUrl: p.imageUrl,
        optionSummary: null,
        unitPriceCents: p.priceCents,
        qty,
        lineTotalCents: p.priceCents * qty,
        maxQty: p.stock,
        available,
      };
    });

    const subtotalCents = lines
      .filter((l) => l.available)
      .reduce((sum, l) => sum + l.lineTotalCents, 0);
    const itemCount = lines.filter((l) => l.available).reduce((sum, l) => sum + l.qty, 0);

    return { lines, subtotalCents, itemCount };
  }

  /** Utilisé par le checkout : lignes de panier brutes (avec produit). */
  async getItemsWithProducts(userId: number): Promise<CartItem[]> {
    const items = await this.cartRepo.find({
      where: { userId },
      relations: { product: true },
      order: { createdAt: 'ASC' },
    });
    if (items.length === 0) {
      throw new BadRequestException('Panier vide');
    }
    return items;
  }
}
