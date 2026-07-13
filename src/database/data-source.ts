import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from '../config/typeorm.config';

// Chargé par la CLI TypeORM (migrations) — hors contexte NestJS, donc on lit
// le .env nous-mêmes.
loadEnv();

export default new DataSource(buildTypeOrmOptions(process.env));
