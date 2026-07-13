import { Controller, Get, Patch, Param, Query, Body, ParseIntPipe } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { ReviewsService } from './reviews.service';
import { ReviewStatus } from './review.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

class ModerateReviewDto {
  @IsIn(Object.values(ReviewStatus))
  status!: ReviewStatus;
}

/** Modération des avis (SPEC §13, back-office). */
@Roles(UserRole.ADMIN)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(@Query('status') status?: ReviewStatus) {
    return this.reviewsService.list(status);
  }

  @Patch(':id')
  moderate(@Param('id', ParseIntPipe) id: number, @Body() dto: ModerateReviewDto) {
    return this.reviewsService.moderate(id, dto.status);
  }
}
