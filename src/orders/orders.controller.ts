import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

/** Commandes du client connecté (scoping par JWT). */
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  listMine(@CurrentUser() user: User) {
    return this.ordersService.findMine(user.id);
  }

  @Get(':id')
  getMine(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findMineOne(user.id, id);
  }
}
