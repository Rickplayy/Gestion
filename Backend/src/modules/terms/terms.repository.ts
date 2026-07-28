import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../../infra/db/pool.js';
import { queryOne, execute } from '../../infra/db/query.js';
import type { TermDto } from './terms.schema.js';

type TermRow = RowDataPacket & {
  ID_CICLO_ESCOLAR: number;
  DESCRIPCION: string;
};

type IdRow = RowDataPacket & { ID_CICLO_ESCOLAR: number };

const mapRow = (row: TermRow): TermDto => ({
  id: row.ID_CICLO_ESCOLAR,
  descripcion: row.DESCRIPCION,
});

export type TermsRepository = {
  existsByDescripcion: (descripcion: string) => Promise<boolean>;
  existsById: (id: number) => Promise<boolean>;
  create: (descripcion: string) => Promise<TermDto>;
};

export const createTermsRepository = (db: DbPool): TermsRepository => ({
  existsByDescripcion: async (descripcion) => {
    const row = await queryOne<IdRow>(
      db,
      'SELECT ID_CICLO_ESCOLAR FROM `SIGE_CCICLO_ESCOLAR` WHERE DESCRIPCION = ? LIMIT 1',
      [descripcion],
    );
    return row !== null;
  },

  existsById: async (id) => {
    const row = await queryOne<IdRow>(
      db,
      'SELECT ID_CICLO_ESCOLAR FROM `SIGE_CCICLO_ESCOLAR` WHERE ID_CICLO_ESCOLAR = ? LIMIT 1',
      [id],
    );
    return row !== null;
  },

  create: async (descripcion) => {
    const result = await execute(
      db,
      'INSERT INTO `SIGE_CCICLO_ESCOLAR` (`DESCRIPCION`) VALUES (?)',
      [descripcion],
    );
    const row = await queryOne<TermRow>(
      db,
      'SELECT ID_CICLO_ESCOLAR, DESCRIPCION FROM `SIGE_CCICLO_ESCOLAR` WHERE ID_CICLO_ESCOLAR = ?',
      [result.insertId],
    );
    if (row === null) {
      throw new Error('No se pudo recuperar el ciclo escolar creado');
    }
    return mapRow(row);
  },
});
