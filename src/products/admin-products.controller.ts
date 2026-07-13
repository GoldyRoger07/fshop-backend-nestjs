import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminProductsService } from './admin-products.service';
import {
  CreateSimpleProductDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/admin-product.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/** Gestion produits back-office (SPEC §12). */
@Roles(UserRole.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly adminProducts: AdminProductsService) {}

  @Get()
  list() {
    return this.adminProducts.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.adminProducts.get(id);
  }

  @Post()
  create(@Body() dto: CreateSimpleProductDto) {
    return this.adminProducts.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.adminProducts.update(id, dto);
  }

  @Put(':productId/variants/:variantId')
  updateVariant(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.adminProducts.updateVariant(productId, variantId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminProducts.remove(id);
  }
}
