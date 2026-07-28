import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TurnsService } from './turns.service.js';
import { errorToStatusCode } from '../../shared/errors/index.js';
import type { CreateAlumnosBody, CreateGruposBody, TermIdQuery } from './turns.schema.js';

export type TurnsController = {
  listCarreras: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
  createGrupos: (
    request: FastifyRequest<{ Querystring: TermIdQuery; Body: CreateGruposBody }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  listGrupos: (
    request: FastifyRequest<{ Querystring: TermIdQuery }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  createAlumnos: (
    request: FastifyRequest<{ Querystring: TermIdQuery; Body: CreateAlumnosBody }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  countAlumnos: (
    request: FastifyRequest<{ Querystring: TermIdQuery }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  assignGroups: (
    request: FastifyRequest<{ Querystring: TermIdQuery }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
};

export const createTurnsController = (service: TurnsService): TurnsController => ({
  listCarreras: async (_request, reply) => {
    const result = await service.listCarreras();
    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return reply.status(200).send(result.value);
  },

  createGrupos: async (request, reply) => {
    const result = await service.createGrupos(request.query.termId, request.body);
    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return reply.status(201).send(result.value);
  },

  listGrupos: async (request, reply) => {
    const result = await service.listGrupos(request.query.termId);
    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return reply.status(200).send(result.value);
  },

  createAlumnos: async (request, reply) => {
    const result = await service.createAlumnos(request.query.termId, request.body);
    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return reply.status(201).send(result.value);
  },

  countAlumnos: async (request, reply) => {
    const result = await service.countAlumnos(request.query.termId);
    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return reply.status(200).send(result.value);
  },

  assignGroups: async (request, reply) => {
    const result = await service.assignGroups(request.query.termId);
    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return reply.status(200).send(result.value);
  },
});
