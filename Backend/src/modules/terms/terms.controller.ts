import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TermsService } from './terms.service.js';
import { errorToStatusCode } from '../../shared/errors/index.js';
import type { CreateTermBody, TermIdParams } from './terms.schema.js';

export type TermsController = {
  create: (
    request: FastifyRequest<{ Body: CreateTermBody }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  list: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
  deleteTerm: (
    request: FastifyRequest<{ Params: TermIdParams }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
};

export const createTermsController = (service: TermsService): TermsController => ({
  create: async (request, reply) => {
    const result = await service.create(request.body);

    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }

    return reply.status(201).send(result.value);
  },

  list: async (_request, reply) => {
    const result = await service.list();

    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }

    return reply.status(200).send(result.value);
  },

  deleteTerm: async (request, reply) => {
    const result = await service.deleteTerm(request.params.termId);

    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }

    return reply.status(200).send(result.value);
  },
});
