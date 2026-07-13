import { IsInt, IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReturnDto {
  @Type(() => Number)
  @IsInt()
  orderId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderItemId?: number | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class AdminNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
