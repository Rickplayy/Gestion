import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { loadEnv, type Env } from './config/env.js';
import { dbPlugin } from './plugins/db.plugin.js';
import { jwtPlugin } from './plugins/jwt.plugin.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { termsRoutes } from './modules/terms/terms.routes.js';
import { turnsRoutes } from './modules/turns/turns.routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
  }
}

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const resolveCorsOrigin = (env: Env): string[] | false => {
  const configured = env.FRONTEND_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (configured.length > 0) {
    return configured;
  }

  return env.NODE_ENV === 'production' ? false : DEV_ORIGINS;
};

export const buildApp = async (env: Env = loadEnv()) => {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    bodyLimit: 20 * 1024 * 1024,
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.decorate('config', env);

  await app.register(cors, {
    origin: resolveCorsOrigin(env),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH'],
  });

  await app.register(dbPlugin);
  await app.register(jwtPlugin);
  await app.register(authPlugin);

  await app.register(healthRoutes);

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(termsRoutes);
      await api.register(turnsRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
};

export type App = Awaited<ReturnType<typeof buildApp>>;
