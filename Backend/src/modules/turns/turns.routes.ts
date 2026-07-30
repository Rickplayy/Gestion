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
  queryAlumnosRouteSchema,
  updateDomicilioRouteSchema,
  updateGrupoRouteSchema,
  type AlumnoPrParams,
  type AlumnosQuery,
  type CreateAlumnosBody,
  type CreateGruposBody,
  type DomicilioRegistro,
  type TermIdQuery,
  type UpdateGrupoBody,
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

  // Endpoint principal de consulta: filtros combinables por secuencia, carrera y sin asignar.
  fastify.get<{ Querystring: AlumnosQuery }>(
    '/terms/turns/alumnos',
    { schema: queryAlumnosRouteSchema, preHandler: [fastify.authenticate] },
    controller.queryAlumnos,
  );

  fastify.post<{ Querystring: TermIdQuery; Body: CreateAlumnosBody }>(
    '/terms/turns/alumnos',
    { schema: createAlumnosRouteSchema, preHandler: [fastify.authenticate] },
    controller.createAlumnos,
  );

  fastify.patch<{ Params: AlumnoPrParams; Querystring: TermIdQuery; Body: DomicilioRegistro }>(
    '/terms/turns/alumnos/:pr/domicilio',
    { schema: updateDomicilioRouteSchema, preHandler: [fastify.authenticate] },
    controller.updateDomicilio,
  );

  fastify.patch<{ Params: AlumnoPrParams; Querystring: TermIdQuery; Body: UpdateGrupoBody }>(
    '/terms/turns/alumnos/:pr/grupo',
    { schema: updateGrupoRouteSchema, preHandler: [fastify.authenticate] },
    controller.updateGrupo,
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
