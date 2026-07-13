import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReturnRequest,
  ReturnStatus,
  ReturnRequestView,
  toReturnView,
} from './return-request.entity';
import { Order, OrderItem, OrderStatus } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { CreateReturnDto } from './dto/return.dto';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectRepository(ReturnRequest)
    private readonly returnRepo: Repository<ReturnRequest>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly ordersService: OrdersService,
  ) {}

  /** Le client demande un retour sur une commande livrée (SPEC §11). */
  async create(userId: number, orderId: number, dto: CreateReturnDto): Promise<ReturnRequestView> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, userId },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException(`Commande ${orderId} introuvable`);
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Seule une commande livrée peut faire l’objet d’un retour');
    }

    let itemName: string | null = null;
    if (dto.orderItemId != null) {
      const item = (order.items ?? []).find((i: OrderItem) => i.id === dto.orderItemId);
      if (!item) throw new BadRequestException('Ligne de commande invalide');
      itemName = item.nameSnapshot;
    }

    const saved = await this.returnRepo.save(
      this.returnRepo.create({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderItemId: dto.orderItemId ?? null,
        itemName,
        customerName: order.customerName,
        reason: dto.reason,
        status: ReturnStatus.REQUESTED,
        adminNote: null,
      }),
    );

    // La commande passe en RETURN_REQUESTED (SPEC §11).
    await this.ordersService.transitionInternal(order.id, OrderStatus.RETURN_REQUESTED);
    return toReturnView(saved);
  }

  /** Retours existants d'une commande (scoping user). */
  async listForOrder(userId: number, orderId: number): Promise<ReturnRequestView[]> {
    const order = await this.orderRepo.findOne({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException(`Commande ${orderId} introuvable`);
    const rows = await this.returnRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toReturnView);
  }

  // --- Admin ---

  async listAll(status?: ReturnStatus): Promise<ReturnRequestView[]> {
    const rows = await this.returnRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
    return rows.map(toReturnView);
  }

  approve(id: number, note?: string): Promise<ReturnRequestView> {
    return this.setDecision(id, ReturnStatus.APPROVED, note);
  }

  reject(id: number, note?: string): Promise<ReturnRequestView> {
    return this.setDecision(id, ReturnStatus.REJECTED, note);
  }

  /** Rembourse : retour → REFUNDED et commande → REFUNDED + restock (SPEC §11). */
  async refund(id: number): Promise<ReturnRequestView> {
    const ret = await this.findEntity(id);
    await this.ordersService.refund(ret.orderId);
    ret.status = ReturnStatus.REFUNDED;
    await this.returnRepo.save(ret);
    return toReturnView(ret);
  }

  countPending(): Promise<number> {
    return this.returnRepo.count({ where: { status: ReturnStatus.REQUESTED } });
  }

  private async setDecision(
    id: number,
    status: ReturnStatus,
    note?: string,
  ): Promise<ReturnRequestView> {
    const ret = await this.findEntity(id);
    if (ret.status !== ReturnStatus.REQUESTED) {
      throw new ConflictException('Cette demande a déjà été traitée');
    }
    ret.status = status;
    if (note !== undefined) ret.adminNote = note;
    await this.returnRepo.save(ret);
    return toReturnView(ret);
  }

  private async findEntity(id: number): Promise<ReturnRequest> {
    const ret = await this.returnRepo.findOne({ where: { id } });
    if (!ret) throw new NotFoundException(`Demande de retour ${id} introuvable`);
    return ret;
  }
}
