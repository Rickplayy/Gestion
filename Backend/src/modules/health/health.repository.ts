import type { DbPool } from '../../infra/db/pool.js';
import { queryRows } from '../../infra/db/query.js';
import { ok, err, type Result } from '../../shared/result/index.js';
import { domainError, DomainErrorCode, type DomainError } from '../../shared/errors/index.js';

export type HealthRepository = {
  pingDatabase: () => Promise<Result<void, DomainError>>;
};

export const createHealthRepository = (db: DbPool): HealthRepository => ({
  pingDatabase: async () => {
    try {
      await queryRows(db, 'SELECT 1', []);
      return ok(undefined);
    } catch (cause) {
      return err(domainError(DomainErrorCode.ServiceUnavailable, 'Database is unreachable', cause));
    }
  },
});
