import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsInt,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../entities/order.entity';

export class CheckoutAddressDto {
  @IsString() @IsNotEmpty() @MaxLength(150)
  fullName!: string;

  @IsString() @IsNotEmpty() @MaxLength(30)
  phone!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  line1!: string;

  @IsOptional() @IsString() @MaxLength(200)
  line2?: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  city!: string;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class PlaceOrderDto {
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  address!: CheckoutAddressDto;

  @Type(() => Number)
  @IsInt()
  zoneId!: number;
}

export class InitPaymentDto {
  @Type(() => Number)
  @IsInt()
  orderId!: number;
}

export class ConfirmPaymentDto {
  @Type(() => Number)
  @IsInt()
  orderId!: number;

  @IsString()
  @IsNotEmpty()
  reference!: string;
}

export class UpdateOrderStatusDto {
  @IsIn(Object.values(OrderStatus))
  status!: OrderStatus;
}
