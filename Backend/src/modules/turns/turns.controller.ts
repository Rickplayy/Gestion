import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TurnsService } from './turns.service.js';
import { errorToStatusCode } from '../../shared/errors/index.js';
import type {
  AlumnoPrParams,
  AlumnosQuery,
  CreateAlumnosBody,
  CreateGruposBody,
  DomicilioRegistro,
  GruposPorCarreraQuery,
  TermIdQuery,
  UpdateGrupoBody,
} from './turns.schema.js';

export type TurnsController = {
  listCarreras: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
  listCarrerasPorCiclo: (
    request: FastifyRequest<{ Querystring: TermIdQuery }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  listGruposPorCarrera: (
    request: FastifyRequest<{ Querystring: GruposPorCarreraQuery }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  createGrupos: (
    request: FastifyRequest<{ Querystring: TermIdQuery; Body: CreateGruposBody }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  queryAlumnos: (
    request: FastifyRequest<{ Querystring: AlumnosQuery }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  createAlumnos: (
    request: FastifyRequest<{ Querystring: TermIdQuery; Body: CreateAlumnosBody }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  updateDomicilio: (
    request: FastifyRequest<{
      Params: AlumnoPrParams;
      Querystring: TermIdQuery;
      Body: DomicilioRegistro;
    }>,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  updateGrupo: (
    request: FastifyRequest<{
      Params: AlumnoPrParams;
      Querystring: TermIdQuery;
      Body: UpdateGrupoBody;
    }>,
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

  listCarrerasPorCiclo: async (request, reply) => {
    const result = await service.listCarrerasPorCiclo(request.query.termId);
    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return reply.status(200).send(result.value);
  },

  listGruposPorCarrera: async (request, reply) => {
    const result = await service.listGruposPorCarrera(
      request.query.termId,
      request.query.carrera,
    );
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

  queryAlumnos: async (request, reply) => {
    const result = await service.queryAlumnos(request.query);
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

  updateDomicilio: async (request, reply) => {
    const result = await service.updateDomicilio(request.params.pr, request.query.termId, request.body);
    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return reply.status(200).send(result.value);
  },

  updateGrupo: async (request, reply) => {
    const result = await service.updateGrupo(
      request.params.pr,
      request.query.termId,
      request.body.idGrupo,
    );
    if (!result.ok) {
      return reply.status(errorToStatusCode(result.error.code)).send({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return reply.status(200).send(result.value);
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
