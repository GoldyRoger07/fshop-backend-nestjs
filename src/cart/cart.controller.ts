import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

/** Panier serveur, lié au compte (auth requise via le JwtAuthGuard global). */
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: User) {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  addItem(@CurrentUser() user: User, @Body() dto: AddToCartDto) {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:lineId')
  updateQty(
    @CurrentUser() user: User,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateQty(user.id, lineId, dto.qty);
  }

  @Delete('items/:lineId')
  removeItem(
    @CurrentUser() user: User,
    @Param('lineId', ParseIntPipe) lineId: number,
  ) {
    return this.cartService.removeItem(user.id, lineId);
  }

  @Delete()
  clear(@CurrentUser() user: User) {
    return this.cartService.clear(user.id);
  }
}
