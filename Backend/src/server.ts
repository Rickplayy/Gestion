import { buildApp, type App } from './app.js';
import { loadEnv } from './config/env.js';
import { createAuthRepository } from './modules/auth/auth.repository.js';
import { hashPassword } from './shared/crypto/password.js';

const registerShutdown = (app: App): void => {
  const signals = ['SIGINT', 'SIGTERM'] as const;

  for (const signal of signals) {
    process.once(signal, () => {
      app.log.info({ signal }, 'shutting down');
      void app
        .close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  }
};

// Mismo comportamiento que el index.js de Express anterior: si SIGE_ADMIN
// está vacía, siembra un admin con ADMIN_USER/ADMIN_PASS del .env.
const seedAdminIfEmpty = async (app: App): Promise<void> => {
  const repository = createAuthRepository(app.db);
  const existing = await repository.count();
  if (existing > 0) {
    return;
  }

  if (app.config.ADMIN_PASS === undefined) {
    app.log.warn(
      'ADMIN_PASS no está definido; se sembrará el admin con una contraseña insegura por defecto.',
    );
  }

  const passwordHash = await hashPassword(app.config.ADMIN_PASS ?? 'admin123');
  await repository.create(app.config.ADMIN_USER, passwordHash);
  app.log.info({ username: app.config.ADMIN_USER }, 'admin sembrado');
};

const start = async (): Promise<void> => {
  const env = loadEnv();
  const app = await buildApp(env);

  registerShutdown(app);

  try {
    await seedAdminIfEmpty(app);
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (cause) {
    app.log.error(cause);
    process.exit(1);
  }
};

void start();
