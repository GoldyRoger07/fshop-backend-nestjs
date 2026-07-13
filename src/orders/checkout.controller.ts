import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PlaceOrderDto, InitPaymentDto, ConfirmPaymentDto } from './dto/checkout.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

/** Tunnel de commande + paiement simulé (auth requise). */
@Controller()
export class CheckoutController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  placeOrder(@CurrentUser() user: User, @Body() dto: PlaceOrderDto) {
    return this.ordersService.checkout(user, dto);
  }

  @Post('payments/moncash/init')
  @HttpCode(HttpStatus.OK)
  initPayment(@CurrentUser() user: User, @Body() dto: InitPaymentDto) {
    return this.ordersService.initPayment(user.id, dto.orderId);
  }

  @Post('payments/moncash/confirm')
  @HttpCode(HttpStatus.OK)
  confirmPayment(@CurrentUser() user: User, @Body() dto: ConfirmPaymentDto) {
    return this.ordersService.confirmPayment(user.id, dto.orderId, dto.reference);
  }
}
