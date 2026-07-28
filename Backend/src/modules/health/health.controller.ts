import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HealthService } from './health.service.js';
import { errorToStatusCode } from '../../shared/errors/index.js';

export type HealthController = {
  getHealth: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
};

export const createHealthController = (service: HealthService): HealthController => ({
  getHealth: async (_request, reply) => {
    const result = await service.check();

    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }

    const statusCode = result.value.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(result.value);
  },
});
