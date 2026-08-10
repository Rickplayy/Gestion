import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../../infra/db/pool.js';
import { execute, queryOne } from '../../infra/db/query.js';

type AdminRow = RowDataPacket & { ID_ADMIN: number; USERNAME: string; PASSWORD: string };
type CountRow = RowDataPacket & { total: number };

export type AdminRecord = { id: number; username: string; password: string };

export type AuthRepository = {
  findByUsername: (username: string) => Promise<AdminRecord | null>;
  count: () => Promise<number>;
  create: (username: string, passwordHash: string) => Promise<number>;
};

export const createAuthRepository = (db: DbPool): AuthRepository => ({
  findByUsername: async (username) => {
    const row = await queryOne<AdminRow>(
      db,
      'SELECT ID_ADMIN, USERNAME, PASSWORD FROM `SIGE_ADMIN` WHERE USERNAME = ? LIMIT 1',
      [username],
    );
    if (row === null) {
      return null;
    }
    return { id: row.ID_ADMIN, username: row.USERNAME, password: row.PASSWORD };
  },

  count: async () => {
    const row = await queryOne<CountRow>(db, 'SELECT COUNT(*) AS total FROM `SIGE_ADMIN`', []);
    return row?.total ?? 0;
  },

  create: async (username, passwordHash) => {
    const result = await execute(
      db,
      'INSERT INTO `SIGE_ADMIN` (`USERNAME`, `PASSWORD`) VALUES (?, ?)',
      [username, passwordHash],
    );
    return result.insertId;
  },
});
