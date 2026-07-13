import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')                   // décompose les accents (é → e + ́)
      .replace(/[\u0300-\u036f]/g, '')    // supprime les diacritiques
      .replace(/[^a-z0-9]+/g, '-')        // tout le reste devient des tirets
      .replace(/(^-|-$)/g, '');           // nettoie les tirets en bordure
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = this.slugify(dto.name);

    const existing = await this.categoryRepo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(
        `Une catégorie avec le nom "${dto.name}" existe déjà`,
      );
    }

    const category = this.categoryRepo.create({ ...dto, slug });
    return this.categoryRepo.save(category);
  }

  findAll(): Promise<Category[]> {
    return this.categoryRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Catégorie ${id} introuvable`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { slug } });
    if (!category) {
      throw new NotFoundException(`Catégorie "${slug}" introuvable`);
    }
    return category;
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    if (dto.name && dto.name !== category.name) {
      const newSlug = this.slugify(dto.name);
      const existing = await this.categoryRepo.findOne({
        where: { slug: newSlug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Une catégorie avec le nom "${dto.name}" existe déjà`,
        );
      }
      category.slug = newSlug;
    }

    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepo.remove(category);
  }
}