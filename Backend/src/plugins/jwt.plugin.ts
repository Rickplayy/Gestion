import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';

export const jwtPlugin = fp(async (fastify: FastifyInstance): Promise<void> => {
  await fastify.register(jwt, {
    secret: fastify.config.JWT_SECRET,
  });
});
