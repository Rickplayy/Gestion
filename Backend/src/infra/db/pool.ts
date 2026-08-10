import { createPool, type Pool } from 'mysql2/promise';
import type { Env } from '../../config/env.js';

export type DbPool = Pool;

export const createDbPool = (env: Env): DbPool =>
  createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    waitForConnections: true,
    namedPlaceholders: true,
    enableKeepAlive: true,
  });
