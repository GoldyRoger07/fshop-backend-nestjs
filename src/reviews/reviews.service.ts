import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewStatus, ReviewView, toReviewView } from './review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  async list(status?: ReviewStatus): Promise<ReviewView[]> {
    const reviews = await this.reviewRepo.find({
      where: status ? { status } : {},
      relations: { product: true },
      order: { createdAt: 'DESC' },
    });
    return reviews.map(toReviewView);
  }

  async moderate(id: number, status: ReviewStatus): Promise<ReviewView> {
    const review = await this.reviewRepo.findOne({
      where: { id },
      relations: { product: true },
    });
    if (!review) throw new NotFoundException(`Avis ${id} introuvable`);
    review.status = status;
    await this.reviewRepo.save(review);
    return toReviewView(review);
  }

  /** Nombre d'avis en attente de modération (dashboard). */
  countPending(): Promise<number> {
    return this.reviewRepo.count({ where: { status: ReviewStatus.PENDING } });
  }
}
