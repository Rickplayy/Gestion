import type { FastifyInstance } from 'fastify';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';
import { loginRouteSchema, type LoginBody } from './auth.schema.js';

export const authRoutes = async (fastify: FastifyInstance): Promise<void> => {
  const repository = createAuthRepository(fastify.db);
  const service = createAuthService(repository, (payload) =>
    fastify.jwt.sign(payload, { expiresIn: fastify.config.JWT_EXPIRY }),
  );
  const controller = createAuthController(service);

  fastify.post<{ Body: LoginBody }>('/auth/login', { schema: loginRouteSchema }, controller.login);
};
