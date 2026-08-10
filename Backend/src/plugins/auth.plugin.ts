import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AccessTokenPayload } from '../modules/auth/auth.schema.js';
import { DomainErrorCode } from '../shared/errors/index.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload & { iat: number; exp: number };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (fastify: FastifyInstance): Promise<void> => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.status(401).send({
        code: DomainErrorCode.Unauthorized,
        message: 'No autenticado',
      });
    }
  });
});
