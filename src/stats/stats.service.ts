import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderItem, OrderStatus, PaymentStatus } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { ReviewsService } from '../reviews/reviews.service';
import { ReturnsService } from '../returns/returns.service';

export interface DashboardStats {
  revenueCents: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  pendingReviewsCount: number;
  pendingReturnsCount: number;
  lowStock: Array<{ productId: number; name: string; slug: string; stock: number }>;
  topProducts: Array<{ productId: number; name: string; qtySold: number }>;
}

const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly reviewsService: ReviewsService,
    private readonly returnsService: ReturnsService,
  ) {}

  async getDashboard(): Promise<DashboardStats> {
    const revenueRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_cents), 0)', 'sum')
      .where('o.payment_status = :paid', { paid: PaymentStatus.PAID })
      .getRawOne<{ sum: string }>();

    const [paidOrdersCount, pendingOrdersCount, pendingReviewsCount, pendingReturnsCount] =
      await Promise.all([
        this.orderRepo.count({ where: { paymentStatus: PaymentStatus.PAID } }),
        this.orderRepo.count({ where: { status: OrderStatus.PENDING_PAYMENT } }),
        this.reviewsService.countPending(),
        this.returnsService.countPending(),
      ]);

    const lowStockRows = await this.productRepo.find({
      where: { isActive: true },
      order: { stock: 'ASC' },
      take: 20,
    });
    const lowStock = lowStockRows
      .filter((p) => p.stock <= LOW_STOCK_THRESHOLD)
      .slice(0, 10)
      .map((p) => ({ productId: p.id, name: p.name, slug: p.slug, stock: p.stock }));

    const topRaw = await this.orderItemRepo
      .createQueryBuilder('item')
      .select('item.product_id', 'productId')
      .addSelect('item.name_snapshot', 'name')
      .addSelect('SUM(item.qty)', 'qtySold')
      .innerJoin(Order, 'o', 'o.id = item.order_id AND o.payment_status = :paid', {
        paid: PaymentStatus.PAID,
      })
      .groupBy('item.product_id')
      .addGroupBy('item.name_snapshot')
      .orderBy('qtySold', 'DESC')
      .limit(5)
      .getRawMany<{ productId: number; name: string; qtySold: string }>();

    const topProducts = topRaw.map((r) => ({
      productId: Number(r.productId),
      name: r.name,
      qtySold: Number(r.qtySold),
    }));

    return {
      revenueCents: Number(revenueRow?.sum ?? 0),
      paidOrdersCount,
      pendingOrdersCount,
      pendingReviewsCount,
      pendingReturnsCount,
      lowStock,
      topProducts,
    };
  }
}
