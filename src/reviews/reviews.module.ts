import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { AdminReviewsController } from './reviews.controller';
import { Review } from './review.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Review])],
  controllers: [AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService], // dashboard stats
})
export class ReviewsModule {}
