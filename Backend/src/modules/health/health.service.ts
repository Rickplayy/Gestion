import type { HealthRepository } from './health.repository.js';
import type { HealthResponse } from './health.schema.js';
import { ok, type Result } from '../../shared/result/index.js';
import type { DomainError } from '../../shared/errors/index.js';

export type HealthService = {
  check: () => Promise<Result<HealthResponse, DomainError>>;
};

export const createHealthService = (repository: HealthRepository): HealthService => ({
  check: async () => {
    const database = await repository.pingDatabase();
    const healthy = database.ok;

    const report: HealthResponse = {
      status: healthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: database.ok ? 'up' : 'down',
      },
    };

    return ok(report);
  },
});
