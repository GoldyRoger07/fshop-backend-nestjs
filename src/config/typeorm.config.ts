import { DataSourceOptions } from 'typeorm';

/**
 * Options TypeORM partagées entre le runtime NestJS (TypeOrmModule.forRootAsync)
 * et la CLI de migration (data-source.ts).
 *
 * NB (SPEC §4.1) : les montants sont des BIGINT en centimes. MySQL renvoie les
 * BIGINT en `string` par défaut (au-delà de 2^53). On garde `bigNumberStrings`
 * au comportement par défaut ; le mapping vers `number`/`Money` se fait dans les
 * entités/DTO au cas par cas.
 */
export function buildTypeOrmOptions(env: NodeJS.ProcessEnv): DataSourceOptions {
  return {
    type: 'mysql',
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    charset: 'utf8mb4',
    timezone: 'Z',
    // Entités déclarées via glob : chaque module ajoute ses *.entity.ts.
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    // Jamais de synchronize en dehors des tests : on passe par les migrations.
    synchronize: false,
    migrationsRun: false,
    logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  };
}
