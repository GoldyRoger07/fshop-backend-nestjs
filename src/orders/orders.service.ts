import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { randomBytes } from 'crypto';
import { Order, OrderItem, OrderStatus, PaymentStatus } from './entities/order.entity';
import { CartItem } from '../cart/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { ALLOWED_TRANSITIONS, OrderView, toOrderView } from './order.view';
import { PlaceOrderDto } from './dto/checkout.dto';
import { ShippingService } from '../shipping/shipping.service';
import { User } from '../users/entities/user.entity';

export interface OrderFilter {
  status?: OrderStatus;
  search?: string;
}

export interface PaymentIntentView {
  orderId: number;
  reference: string;
  redirectUrl: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly shippingService: ShippingService,
  ) {}

  /** Tunnel de commande transactionnel (SPEC §9). Crée une commande PENDING_PAYMENT. */
  async checkout(user: User, dto: PlaceOrderDto): Promise<OrderView> {
    const zone = await this.shippingService.findZone(dto.zoneId);
    if (!zone.active) {
      throw new BadRequestException('Zone de livraison indisponible');
    }

    const order = await this.dataSource.transaction(async (manager) => {
      const cartItems = await manager.find(CartItem, {
        where: { userId: user.id },
        relations: { product: true },
      });
      const available = cartItems.filter((it) => it.product.isActive && it.product.stock > 0);
      if (available.length === 0) {
        throw new BadRequestException('Panier vide ou indisponible');
      }

      const items: OrderItem[] = [];
      let subtotalCents = 0;

      for (const it of available) {
        const qty = Math.min(it.qty, it.product.stock);
        // Décrément atomique : 0 ligne affectée ⇒ rupture (anti-survente, SPEC §8).
        const res = await manager.query(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [qty, it.productId, qty],
        );
        if (res.affectedRows === 0) {
          throw new ConflictException(`Stock insuffisant pour "${it.product.name}"`);
        }

        const unit = it.product.priceCents;
        const item = manager.create(OrderItem, {
          productId: it.productId,
          slug: it.product.slug,
          nameSnapshot: it.product.name,
          unitPriceCentsSnapshot: unit,
          qty,
          lineTotalCents: unit * qty,
        });
        items.push(item);
        subtotalCents += unit * qty;
      }

      const shippingCents = zone.feeCents;
      // orderNumber définitif nécessite l'id → placeholder puis mise à jour.
      const tmpNumber = `TMP-${randomBytes(8).toString('hex')}`;
      const created = manager.create(Order, {
        orderNumber: tmpNumber,
        userId: user.id,
        status: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        customerName: user.fullName,
        customerEmail: user.email,
        subtotalCents,
        shippingCents,
        totalCents: subtotalCents + shippingCents,
        shippingAddress: {
          fullName: dto.address.fullName,
          phone: dto.address.phone,
          zoneName: zone.name,
          line1: dto.address.line1,
          line2: dto.address.line2,
          city: dto.address.city,
          notes: dto.address.notes,
        },
        items,
      });
      const saved = await manager.save(created);
      saved.orderNumber = `FS-${new Date().getFullYear()}-${saved.id}`;
      await manager.save(saved);

      // Panier consommé.
      await manager.delete(CartItem, { userId: user.id });
      return saved;
    });

    return toOrderView(await this.findEntity(order.id));
  }

  /** Paiement simulé : renvoie une référence + URL de redirection factice. */
  async initPayment(userId: number, orderId: number): Promise<PaymentIntentView> {
    const order = await this.findScoped(userId, orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException('Commande déjà traitée');
    }
    const reference = `MONCASH-${orderId}-${randomBytes(4).toString('hex').toUpperCase()}`;
    order.paymentReference = reference;
    await this.orderRepo.save(order);
    return { orderId, reference, redirectUrl: `#moncash/${reference}` };
  }

  /** Confirmation vérifiée « serveur » (simulée). Idempotent (SPEC §10.3). */
  async confirmPayment(userId: number, orderId: number, reference: string): Promise<OrderView> {
    const order = await this.findScoped(userId, orderId);
    if (order.paymentReference && order.paymentReference !== reference) {
      throw new BadRequestException('Référence de paiement invalide');
    }
    if (order.status === OrderStatus.PENDING_PAYMENT) {
      order.status = OrderStatus.PAID;
      order.paymentStatus = PaymentStatus.PAID;
      await this.orderRepo.save(order);
    }
    return toOrderView(await this.findEntity(order.id));
  }

  // --- Lecture client ---

  async findMine(userId: number): Promise<OrderView[]> {
    const orders = await this.orderRepo.find({
      where: { userId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
    return orders.map(toOrderView);
  }

  async findMineOne(userId: number, id: number): Promise<OrderView> {
    return toOrderView(await this.findScoped(userId, id));
  }

  // --- Lecture / gestion admin ---

  async adminList(filter: OrderFilter): Promise<OrderView[]> {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .orderBy('order.createdAt', 'DESC');
    if (filter.status) qb.andWhere('order.status = :status', { status: filter.status });
    if (filter.search) {
      qb.andWhere(
        '(order.orderNumber LIKE :s OR order.customerName LIKE :s OR order.customerEmail LIKE :s)',
        { s: `%${filter.search}%` },
      );
    }
    return (await qb.getMany()).map(toOrderView);
  }

  async adminGet(id: number): Promise<OrderView> {
    return toOrderView(await this.findEntity(id));
  }

  /** Transition de statut manuelle admin (SPEC §11). Restocke à l'annulation. */
  async updateStatus(id: number, next: OrderStatus): Promise<OrderView> {
    const order = await this.findEntity(id);
    if (!ALLOWED_TRANSITIONS[order.status].includes(next)) {
      throw new ConflictException(`Transition ${order.status} → ${next} interdite`);
    }
    await this.applyTransition(order, next);
    return toOrderView(await this.findEntity(id));
  }

  /** Remboursement (PSP ou hors-ligne) → REFUNDED + restock. */
  async refund(id: number): Promise<OrderView> {
    const order = await this.findEntity(id);
    if (order.status === OrderStatus.REFUNDED) {
      return toOrderView(order);
    }
    await this.dataSource.transaction(async (manager) => {
      await this.restock(manager, order);
      order.status = OrderStatus.REFUNDED;
      order.paymentStatus = PaymentStatus.REFUNDED;
      await manager.save(order);
    });
    return toOrderView(await this.findEntity(id));
  }

  /** Utilisé par le module retours : force une transition + effets (restock). */
  async transitionInternal(id: number, next: OrderStatus): Promise<Order> {
    const order = await this.findEntity(id);
    await this.applyTransition(order, next);
    return this.findEntity(id);
  }

  private async applyTransition(order: Order, next: OrderStatus): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (next === OrderStatus.CANCELLED || next === OrderStatus.REFUNDED) {
        await this.restock(manager, order);
        if (next === OrderStatus.REFUNDED) order.paymentStatus = PaymentStatus.REFUNDED;
      }
      order.status = next;
      await manager.save(order);
    });
  }

  private async restock(manager: EntityManager, order: Order): Promise<void> {
    const items = order.items ?? (await manager.find(OrderItem, { where: { orderId: order.id } }));
    for (const it of items) {
      await manager.query('UPDATE products SET stock = stock + ? WHERE id = ?', [
        it.qty,
        it.productId,
      ]);
    }
  }

  private async findEntity(id: number): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id }, relations: { items: true } });
    if (!order) throw new NotFoundException(`Commande ${id} introuvable`);
    return order;
  }

  private async findScoped(userId: number, id: number): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id, userId },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException(`Commande ${id} introuvable`);
    return order;
  }
}
