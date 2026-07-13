import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from 'typeorm'

@Entity('categories')
export class Category {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({length: 100, unique: true})
    name!: string;

    @Column({length: 120, unique: true})
    slug!: string;

    @Column('text', {nullable: true})
    description!: string | null;

    // Hiérarchie de catégories (contrat front : parentId). Plat en v1 (null).
    @Column({ name: 'parent_id', type: 'int', nullable: true })
    parentId!: number | null;

    // Ordre d'affichage dans les menus/listes.
    @Column({ type: 'int', default: 0 })
    position!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
