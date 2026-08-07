import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../../infra/db/pool.js';
import { queryOne, queryRows, execute } from '../../infra/db/query.js';
import type { TermDto, TermWithCarreras } from './terms.schema.js';

type TermRow = RowDataPacket & {
  ID_CICLO_ESCOLAR: number;
  DESCRIPCION: string;
};

type TermCarreraRow = RowDataPacket & {
  ID_CICLO_ESCOLAR: number;
  ID_CARRERA: number;
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
  listAll: () => Promise<TermWithCarreras[]>;
};

export const createTermsRepository = (db: DbPool): TermsRepository => ({
  listAll: async () => {
    const terms = await queryRows<TermRow>(
      db,
      'SELECT ID_CICLO_ESCOLAR, DESCRIPCION FROM `SIGE_CCICLO_ESCOLAR` ORDER BY ID_CICLO_ESCOLAR DESC',
      [],
    );

    // Carreras "activas" en un ciclo = las que ya tienen grupos creados ahí.
    const carrerasRows = await queryRows<TermCarreraRow>(
      db,
      `SELECT DISTINCT g.ID_CICLO_ESCOLAR, c.ID_CARRERA, c.DESCRIPCION
       FROM \`SIGE_GRUPOS\` g
       JOIN \`SIGE_CCARRERAS\` c ON c.ID_CARRERA = g.ID_CARRERA
       ORDER BY c.DESCRIPCION`,
      [],
    );

    const carrerasPorCiclo = new Map<number, { id: number; descripcion: string }[]>();
    for (const row of carrerasRows) {
      const list = carrerasPorCiclo.get(row.ID_CICLO_ESCOLAR) ?? [];
      list.push({ id: row.ID_CARRERA, descripcion: row.DESCRIPCION });
      carrerasPorCiclo.set(row.ID_CICLO_ESCOLAR, list);
    }

    return terms.map((row) => ({
      ...mapRow(row),
      carreras: carrerasPorCiclo.get(row.ID_CICLO_ESCOLAR) ?? [],
    }));
  },

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
