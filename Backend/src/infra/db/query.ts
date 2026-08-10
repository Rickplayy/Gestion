import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export type QueryParam = string | number | bigint | boolean | Date | Buffer | null | QueryParam[];

export type Executor = Pool | PoolConnection;

export const queryRows = async <T extends RowDataPacket = RowDataPacket>(
  db: Executor,
  sql: string,
  params: ReadonlyArray<QueryParam> = [],
): Promise<T[]> => {
  const [rows] = await db.execute<T[]>(sql, params as QueryParam[]);
  return rows;
};

export const queryOne = async <T extends RowDataPacket = RowDataPacket>(
  db: Executor,
  sql: string,
  params: ReadonlyArray<QueryParam> = [],
): Promise<T | null> => {
  const rows = await queryRows<T>(db, sql, params);
  return rows[0] ?? null;
};

export const execute = async (
  db: Executor,
  sql: string,
  params: ReadonlyArray<QueryParam> = [],
): Promise<ResultSetHeader> => {
  const [result] = await db.execute<ResultSetHeader>(sql, params as QueryParam[]);
  return result;
};

export const withTransaction = async <T>(
  pool: Pool,
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (cause) {
    await conn.rollback();
    throw cause;
  } finally {
    conn.release();
  }
};
