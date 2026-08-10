import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createDbPool, type DbPool } from '../infra/db/pool.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: DbPool;
  }
}

export const dbPlugin = fp(async (fastify: FastifyInstance): Promise<void> => {
  const pool = createDbPool(fastify.config);

  fastify.decorate('db', pool);
  fastify.addHook('onClose', async () => {
    await pool.end();
  });
});
