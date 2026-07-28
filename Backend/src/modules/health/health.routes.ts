import type { FastifyInstance } from 'fastify';
import { createHealthRepository } from './health.repository.js';
import { createHealthService } from './health.service.js';
import { createHealthController } from './health.controller.js';
import { healthRouteSchema } from './health.schema.js';

export const healthRoutes = async (fastify: FastifyInstance): Promise<void> => {
  const repository = createHealthRepository(fastify.db);
  const service = createHealthService(repository);
  const controller = createHealthController(service);

  fastify.get('/health', { schema: healthRouteSchema }, controller.getHealth);
};
