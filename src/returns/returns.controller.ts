import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto, AdminNoteDto } from './dto/return.dto';
import { ReturnStatus } from './return-request.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/** Retours côté client : rattachés à une commande (auth requise). */
@Controller('orders/:orderId/returns')
export class OrderReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  listForOrder(
    @CurrentUser() user: User,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    return this.returnsService.listForOrder(user.id, orderId);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returnsService.create(user.id, orderId, dto);
  }
}

/** Traitement admin des retours (SPEC §11). */
@Roles(UserRole.ADMIN)
@Controller('admin/returns')
export class AdminReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  list(@Query('status') status?: ReturnStatus) {
    return this.returnsService.listAll(status);
  }

  @Post(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: AdminNoteDto) {
    return this.returnsService.approve(id, dto.note);
  }

  @Post(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: AdminNoteDto) {
    return this.returnsService.reject(id, dto.note);
  }

  @Post(':id/refund')
  refund(@Param('id', ParseIntPipe) id: number) {
    return this.returnsService.refund(id);
  }
}
