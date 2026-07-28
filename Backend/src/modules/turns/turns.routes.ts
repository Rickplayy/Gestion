import type { FastifyInstance } from 'fastify';
import { createOsrmClient } from '../../infra/geo/osrm.client.js';
import { createTurnsRepository } from './turns.repository.js';
import { createTurnsService } from './turns.service.js';
import { createTurnsController } from './turns.controller.js';
import {
  asignarGruposRouteSchema,
  conteoAlumnosRouteSchema,
  createAlumnosRouteSchema,
  createGruposRouteSchema,
  listCarrerasRouteSchema,
  listGruposRouteSchema,
  type CreateAlumnosBody,
  type CreateGruposBody,
  type TermIdQuery,
} from './turns.schema.js';

export const turnsRoutes = async (fastify: FastifyInstance): Promise<void> => {
  const osrm = createOsrmClient(fastify.config.OSRM_URL);
  const repository = createTurnsRepository(fastify.db, osrm);
  const service = createTurnsService(repository, {
    lat: fastify.config.UPIICSA_LAT,
    lon: fastify.config.UPIICSA_LON,
  });
  const controller = createTurnsController(service);

  // Público: lo usa el formulario de registro para poblar el selector de carrera.
  fastify.get(
    '/turns/carreras',
    { schema: listCarrerasRouteSchema },
    controller.listCarreras,
  );

  fastify.post<{ Querystring: TermIdQuery; Body: CreateGruposBody }>(
    '/terms/turns/grupos',
    { schema: createGruposRouteSchema, preHandler: [fastify.authenticate] },
    controller.createGrupos,
  );

  fastify.get<{ Querystring: TermIdQuery }>(
    '/terms/turns/grupos',
    { schema: listGruposRouteSchema, preHandler: [fastify.authenticate] },
    controller.listGrupos,
  );

  fastify.post<{ Querystring: TermIdQuery; Body: CreateAlumnosBody }>(
    '/terms/turns/alumnos',
    { schema: createAlumnosRouteSchema, preHandler: [fastify.authenticate] },
    controller.createAlumnos,
  );

  fastify.get<{ Querystring: TermIdQuery }>(
    '/terms/turns/alumnos/conteo',
    { schema: conteoAlumnosRouteSchema, preHandler: [fastify.authenticate] },
    controller.countAlumnos,
  );

  fastify.get<{ Querystring: TermIdQuery }>(
    '/terms/turns/grupos/asignar',
    { schema: asignarGruposRouteSchema, preHandler: [fastify.authenticate] },
    controller.assignGroups,
  );
};
