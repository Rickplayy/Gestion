import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from './auth.service.js';
import type { LoginBody } from './auth.schema.js';
import { errorToStatusCode } from '../../shared/errors/index.js';

export type AuthController = {
  login: (
    request: FastifyRequest<{ Body: LoginBody }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
};

export const createAuthController = (service: AuthService): AuthController => ({
  login: async (request, reply) => {
    const result = await service.login(request.body);

    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }

    return reply.status(200).send(result.value);
  },
});
