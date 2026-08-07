import type { FastifyInstance } from 'fastify';
import { createTermsRepository } from './terms.repository.js';
import { createTermsService } from './terms.service.js';
import { createTermsController } from './terms.controller.js';
import {
  createTermRouteSchema,
  listTermsRouteSchema,
  type CreateTermBody,
} from './terms.schema.js';

export const termsRoutes = async (fastify: FastifyInstance): Promise<void> => {
  const repository = createTermsRepository(fastify.db);
  const service = createTermsService(repository);
  const controller = createTermsController(service);

  fastify.post<{ Body: CreateTermBody }>(
    '/terms',
    { schema: createTermRouteSchema, preHandler: [fastify.authenticate] },
    controller.create,
  );

  fastify.get(
    '/terms',
    { schema: listTermsRouteSchema, preHandler: [fastify.authenticate] },
    controller.list,
  );
};
