import type { RowDataPacket } from 'mysql2/promise';
import type { GeoPoint } from '../../infra/geo/osrm.client.js';
import type { OsrmClient } from '../../infra/geo/osrm.client.js';
import type { DbPool } from '../../infra/db/pool.js';
import { queryRows, queryOne, execute, withTransaction } from '../../infra/db/query.js';
import { parseDateDDMMYYYY } from '../../shared/dates/parse-date.js';
import type {
  AlumnoRegistroInput,
  Carrera,
  ConteoAlumnosResponse,
  DomicilioRegistro,
  GrupoCreated,
  GrupoInput,
  GrupoListItem,
} from './turns.schema.js';

export type InsertAlumnoOutcome =
  | { status: 'inserted' }
  | { status: 'duplicate' }
  | { status: 'failed'; motivo: string };

export type AsignarGruposResult = {
  totalAlumnos: number;
  asignados: number;
  sinGrupo: number;
};

export type TurnsRepository = {
  listCarreras: () => Promise<Carrera[]>;
  termExists: (termId: number) => Promise<boolean>;
  findExistingSecuencias: (termId: number, secuencias: string[]) => Promise<string[]>;
  insertGrupos: (termId: number, grupos: GrupoInput[]) => Promise<GrupoCreated[]>;
  listGrupos: (termId: number) => Promise<GrupoListItem[]>;
  insertAlumno: (
    termId: number,
    alumno: AlumnoRegistroInput,
    reference: GeoPoint,
  ) => Promise<InsertAlumnoOutcome>;
  countByGenero: (termId: number) => Promise<ConteoAlumnosResponse>;
  assignGroups: (termId: number) => Promise<AsignarGruposResult>;
};

// ---------------------------------------------------------------------------
// Matching contra catálogo de colonias. Nombres de tabla/columna deben
// coincidir EXACTO con Script_SIGE.sql (mayúsculas).
// ---------------------------------------------------------------------------

type ColoniaRow = RowDataPacket & {
  ID_COLONIA: number;
  LATITUD: string | number;
  LONGITUD: string | number;
};

type ColoniaMatch = { idColonia: number; point: GeoPoint; nivel: 1 | 2 | 3 | 4 };

const toColoniaMatch = (row: ColoniaRow, nivel: 1 | 2 | 3 | 4): ColoniaMatch => ({
  idColonia: row.ID_COLONIA,
  point: { lat: Number(row.LATITUD), lon: Number(row.LONGITUD) },
  nivel,
});

const matchColonia = async (
  db: DbPool,
  domicilio: DomicilioRegistro,
): Promise<ColoniaMatch | null> => {
  const { COLONIA, CP } = domicilio;

  const exactMatch = await queryOne<ColoniaRow>(
    db,
    'SELECT ID_COLONIA, LATITUD, LONGITUD FROM `SIGE_CCOLONIAS` WHERE CP = ? AND UPPER(TRIM(NOMBRE)) = UPPER(TRIM(?)) LIMIT 1',
    [CP, COLONIA],
  );
  if (exactMatch !== null) {
    return toColoniaMatch(exactMatch, 1);
  }

  const cpMatch = await queryOne<ColoniaRow>(
    db,
    'SELECT ID_COLONIA, LATITUD, LONGITUD FROM `SIGE_CCOLONIAS` WHERE CP = ? ORDER BY ID_COLONIA LIMIT 1',
    [CP],
  );
  if (cpMatch !== null) {
    return toColoniaMatch(cpMatch, 2);
  }

  const municipioMatch = await queryOne<ColoniaRow>(
    db,
    `SELECT c.ID_COLONIA, c.LATITUD, c.LONGITUD
     FROM \`SIGE_CCOLONIAS\` c
     JOIN \`SIGE_CMUNICIPIOS\` m ON m.ID_MUNICIPIO = c.ID_MUNICIPIO
     WHERE ? BETWEEN m.CP_MIN AND m.CP_MAX
     ORDER BY ABS(CAST(c.CP AS SIGNED) - CAST(? AS SIGNED))
     LIMIT 1`,
    [CP, CP],
  );
  if (municipioMatch !== null) {
    return toColoniaMatch(municipioMatch, 3);
  }

  const estadoMatch = await queryOne<ColoniaRow>(
    db,
    `SELECT c.ID_COLONIA, c.LATITUD, c.LONGITUD
     FROM \`SIGE_CCOLONIAS\` c
     JOIN \`SIGE_CMUNICIPIOS\` m ON m.ID_MUNICIPIO = c.ID_MUNICIPIO
     JOIN \`SIGE_CEDOS\` e ON e.ID_EDO = m.ID_EDO
     WHERE ? BETWEEN e.CP_MIN AND e.CP_MAX
     ORDER BY ABS(CAST(c.CP AS SIGNED) - CAST(? AS SIGNED))
     LIMIT 1`,
    [CP, CP],
  );
  if (estadoMatch !== null) {
    return toColoniaMatch(estadoMatch, 4);
  }

  return null;
};

type IdRow = RowDataPacket & { PRE_REGISTRO: string };
type TermIdRow = RowDataPacket & { ID_CICLO_ESCOLAR: number };
type CarreraRow = RowDataPacket & { ID_CARRERA: number; DESCRIPCION: string };
type GrupoRow = RowDataPacket & {
  ID_GRUPO: number;
  CUPO: number;
  TURNO: string;
  ID_CARRERA: number;
};
type GrupoListRow = RowDataPacket & {
  ID_GRUPO: number;
  SECUENCIA: string;
  CUPO: number;
  TURNO: string;
  ID_CARRERA: number;
  DESCRIPCION: string;
};
type AlumnoAsignacionRow = RowDataPacket & {
  PRE_REGISTRO: string;
  GENERO: string;
  PROMEDIO: string | number | null;
  ID_CARRERA: number;
  DISTANCIA_METROS: string | number | null;
};
type GrupoAlumnoRow = AlumnoAsignacionRow & { NOMBRE: string; ID_GRUPO: number };
type ConteoRow = RowDataPacket & {
  ID_CARRERA: number;
  DESCRIPCION: string;
  GENERO: string;
  TOTAL: number;
};

const generoRank = (genero: string): number => (genero === 'F' ? 0 : 1);

// Más lejos = mayor prioridad; sin distancia = va al final. Mismo criterio que turns.service.ts.
const compareAlumnoPriority = (a: AlumnoAsignacionRow, b: AlumnoAsignacionRow): number => {
  const aDist = a.DISTANCIA_METROS === null ? null : Number(a.DISTANCIA_METROS);
  const bDist = b.DISTANCIA_METROS === null ? null : Number(b.DISTANCIA_METROS);

  if (aDist === null && bDist === null) {
    return 0;
  }
  if (aDist === null) {
    return 1;
  }
  if (bDist === null) {
    return -1;
  }

  const distanceDiff = bDist - aDist;
  if (distanceDiff !== 0) {
    return distanceDiff;
  }

  const generoDiff = generoRank(a.GENERO) - generoRank(b.GENERO);
  if (generoDiff !== 0) {
    return generoDiff;
  }

  const aProm = a.PROMEDIO === null ? -1 : Number(a.PROMEDIO);
  const bProm = b.PROMEDIO === null ? -1 : Number(b.PROMEDIO);
  return bProm - aProm;
};

export const createTurnsRepository = (db: DbPool, osrm: OsrmClient): TurnsRepository => ({
  listCarreras: async () => {
    const rows = await queryRows<CarreraRow>(
      db,
      'SELECT ID_CARRERA, DESCRIPCION FROM `SIGE_CCARRERAS` ORDER BY ID_CARRERA',
      [],
    );
    return rows.map((row) => ({ id: row.ID_CARRERA, descripcion: row.DESCRIPCION }));
  },

  termExists: async (termId) => {
    const row = await queryOne<TermIdRow>(
      db,
      'SELECT ID_CICLO_ESCOLAR FROM `SIGE_CCICLO_ESCOLAR` WHERE ID_CICLO_ESCOLAR = ? LIMIT 1',
      [termId],
    );
    return row !== null;
  },

  findExistingSecuencias: async (termId, secuencias) => {
    if (secuencias.length === 0) {
      return [];
    }
    const placeholders = secuencias.map(() => '?').join(', ');
    const rows = await queryRows<RowDataPacket & { SECUENCIA: string }>(
      db,
      `SELECT SECUENCIA FROM \`SIGE_GRUPOS\` WHERE ID_CICLO_ESCOLAR = ? AND SECUENCIA IN (${placeholders})`,
      [termId, ...secuencias],
    );
    return rows.map((row) => row.SECUENCIA);
  },

  insertGrupos: async (termId, grupos) =>
    withTransaction(db, async (conn) => {
      const created: GrupoCreated[] = [];
      for (const grupo of grupos) {
        const result = await execute(
          conn,
          'INSERT INTO `SIGE_GRUPOS` (`SECUENCIA`, `CUPO`, `TURNO`, `ID_CARRERA`, `ID_CICLO_ESCOLAR`) VALUES (?, ?, ?, ?, ?)',
          [grupo.secuencia, grupo.cupo, grupo.turno, grupo.carrera, termId],
        );
        created.push({
          id: result.insertId,
          secuencia: grupo.secuencia,
          cupo: grupo.cupo,
          turno: grupo.turno,
          idCarrera: grupo.carrera,
        });
      }
      return created;
    }),

  listGrupos: async (termId) => {
    const rows = await queryRows<GrupoListRow>(
      db,
      `SELECT g.ID_GRUPO, g.SECUENCIA, g.CUPO, g.TURNO, g.ID_CARRERA, c.DESCRIPCION
       FROM \`SIGE_GRUPOS\` g
       JOIN \`SIGE_CCARRERAS\` c ON c.ID_CARRERA = g.ID_CARRERA
       WHERE g.ID_CICLO_ESCOLAR = ?
       ORDER BY g.ID_CARRERA, g.TURNO ASC, g.SECUENCIA ASC`,
      [termId],
    );

    const alumnoRows = await queryRows<GrupoAlumnoRow>(
      db,
      `SELECT d.PRE_REGISTRO, d.NOMBRE, d.GENERO, d.PROMEDIO, d.ID_CARRERA, d.ID_GRUPO, i.DISTANCIA_METROS
       FROM \`SIGE_DATOS_INGRESO\` d
       LEFT JOIN \`SIGE_INFO_DISTANCIA\` i ON i.PRE_REGISTRO = d.PRE_REGISTRO
       WHERE d.ID_CICLO_ESCOLAR = ? AND d.ID_GRUPO IS NOT NULL`,
      [termId],
    );

    const alumnosPorGrupo = new Map<number, GrupoAlumnoRow[]>();
    for (const row of alumnoRows) {
      const list = alumnosPorGrupo.get(row.ID_GRUPO);
      if (list === undefined) {
        alumnosPorGrupo.set(row.ID_GRUPO, [row]);
      } else {
        list.push(row);
      }
    }

    return rows.map((row) => ({
      id: row.ID_GRUPO,
      secuencia: row.SECUENCIA,
      cupo: row.CUPO,
      turno: row.TURNO,
      idCarrera: row.ID_CARRERA,
      carrera: row.DESCRIPCION,
      alumnos: (alumnosPorGrupo.get(row.ID_GRUPO) ?? [])
        .sort(compareAlumnoPriority)
        .map((alumno) => ({
          pr: alumno.PRE_REGISTRO,
          nombre: alumno.NOMBRE,
          genero: alumno.GENERO,
          promedio: alumno.PROMEDIO === null ? null : Number(alumno.PROMEDIO),
          distanceMeters: alumno.DISTANCIA_METROS === null ? null : Number(alumno.DISTANCIA_METROS),
        })),
    }));
  },

  insertAlumno: async (termId, alumno, reference) => {
    try {
      const existing = await queryOne<IdRow>(
        db,
        'SELECT PRE_REGISTRO FROM `SIGE_DATOS_INGRESO` WHERE PRE_REGISTRO = ? LIMIT 1',
        [alumno.PR],
      );
      if (existing !== null) {
        return { status: 'duplicate' };
      }

      const match = await matchColonia(db, alumno.DOMICILIO);

      let distancia: { metros: number; nivel: 1 | 2 | 3 | 4 } | null = null;
      if (match !== null) {
        const route = await osrm.route(match.point, reference);
        if (route !== null) {
          distancia = { metros: route.meters, nivel: match.nivel };
        }
      }

      const nacimiento = parseDateDDMMYYYY(alumno.FECHA_NACIMIENTO);

      await withTransaction(db, async (conn) => {
        const domicilioResult = await execute(
          conn,
          'INSERT INTO `SIGE_DOMICILIOS` (`CALLE`, `NUMERO`, `ID_COLONIA`) VALUES (?, ?, ?)',
          [alumno.DOMICILIO.CALLE, alumno.DOMICILIO.NUMERO, match?.idColonia ?? null],
        );

        await execute(
          conn,
          `INSERT INTO \`SIGE_DATOS_INGRESO\`
            (\`PRE_REGISTRO\`, \`BOLETA\`, \`CURP\`, \`NOMBRE\`, \`CORREO\`, \`FOLIO\`, \`NACIMIENTO\`,
             \`GENERO\`, \`ID_DOMICILIO\`, \`ESCUELA_PROCEDENCIA\`, \`ENTIDAD_ESCUELA\`, \`PROMEDIO\`,
             \`ID_CARRERA\`, \`ID_ESTATUS\`, \`ID_CICLO_ESCOLAR\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            alumno.PR,
            alumno.BOLETA,
            alumno.CURP,
            alumno.NOMBRE,
            alumno.EMAIL,
            alumno.FOLIO,
            nacimiento,
            alumno.SEXO,
            domicilioResult.insertId,
            alumno.ESCUELA_PROCEDENCIA,
            alumno.ENTIDAD_ESCUELA,
            alumno.PROMEDIO ?? null,
            alumno.PROGRAMA_EDUCATIVO,
            alumno.ESTATUS,
            termId,
          ],
        );

        if (distancia !== null) {
          await execute(
            conn,
            'INSERT INTO `SIGE_INFO_DISTANCIA` (`DISTANCIA_METROS`, `NIVEL`, `PRE_REGISTRO`) VALUES (?, ?, ?)',
            [distancia.metros, distancia.nivel, alumno.PR],
          );
        }
      });

      return { status: 'inserted' };
    } catch (cause) {
      return {
        status: 'failed',
        motivo: cause instanceof Error ? cause.message : 'Error desconocido',
      };
    }
  },

  countByGenero: async (termId) => {
    const rows = await queryRows<ConteoRow>(
      db,
      `SELECT d.ID_CARRERA, c.DESCRIPCION, d.GENERO, COUNT(*) AS TOTAL
       FROM \`SIGE_DATOS_INGRESO\` d
       JOIN \`SIGE_CCARRERAS\` c ON c.ID_CARRERA = d.ID_CARRERA
       WHERE d.ID_CICLO_ESCOLAR = ?
       GROUP BY d.ID_CARRERA, c.DESCRIPCION, d.GENERO`,
      [termId],
    );

    const porCarrera = new Map<
      number,
      { descripcion: string; hombres: number; mujeres: number }
    >();
    let hombres = 0;
    let mujeres = 0;

    for (const row of rows) {
      const entry = porCarrera.get(row.ID_CARRERA) ?? {
        descripcion: row.DESCRIPCION,
        hombres: 0,
        mujeres: 0,
      };
      if (row.GENERO === 'F') {
        entry.mujeres += row.TOTAL;
        mujeres += row.TOTAL;
      } else {
        entry.hombres += row.TOTAL;
        hombres += row.TOTAL;
      }
      porCarrera.set(row.ID_CARRERA, entry);
    }

    const carreras = [...porCarrera.entries()]
      .sort(([a], [b]) => a - b)
      .map(([idCarrera, entry]) => ({
        idCarrera,
        descripcion: entry.descripcion,
        total: entry.hombres + entry.mujeres,
        hombres: entry.hombres,
        mujeres: entry.mujeres,
      }));

    return { carreras, total: hombres + mujeres, hombres, mujeres };
  },

  assignGroups: async (termId) =>
    withTransaction(db, async (conn) => {
      await execute(conn, 'UPDATE `SIGE_DATOS_INGRESO` SET `ID_GRUPO` = NULL WHERE ID_CICLO_ESCOLAR = ?', [
        termId,
      ]);

      const gruposRows = await queryRows<GrupoRow>(
        conn,
        'SELECT ID_GRUPO, CUPO, TURNO, ID_CARRERA FROM `SIGE_GRUPOS` WHERE ID_CICLO_ESCOLAR = ? ORDER BY ID_CARRERA, TURNO ASC, SECUENCIA ASC',
        [termId],
      );

      const alumnosRows = await queryRows<AlumnoAsignacionRow>(
        conn,
        `SELECT d.PRE_REGISTRO, d.GENERO, d.PROMEDIO, d.ID_CARRERA, i.DISTANCIA_METROS
         FROM \`SIGE_DATOS_INGRESO\` d
         LEFT JOIN \`SIGE_INFO_DISTANCIA\` i ON i.PRE_REGISTRO = d.PRE_REGISTRO
         WHERE d.ID_CICLO_ESCOLAR = ?`,
        [termId],
      );

      const gruposPorCarrera = new Map<number, GrupoRow[]>();
      for (const grupo of gruposRows) {
        const list = gruposPorCarrera.get(grupo.ID_CARRERA);
        if (list === undefined) {
          gruposPorCarrera.set(grupo.ID_CARRERA, [grupo]);
        } else {
          list.push(grupo);
        }
      }

      const alumnosPorCarrera = new Map<number, AlumnoAsignacionRow[]>();
      for (const alumno of alumnosRows) {
        const list = alumnosPorCarrera.get(alumno.ID_CARRERA);
        if (list === undefined) {
          alumnosPorCarrera.set(alumno.ID_CARRERA, [alumno]);
        } else {
          list.push(alumno);
        }
      }

      let asignados = 0;
      for (const [idCarrera, alumnosCarrera] of alumnosPorCarrera) {
        const sorted = [...alumnosCarrera].sort(compareAlumnoPriority);
        const grupos = gruposPorCarrera.get(idCarrera) ?? [];

        let cursor = 0;
        for (const grupo of grupos) {
          const slice = sorted.slice(cursor, cursor + grupo.CUPO);
          for (const alumno of slice) {
            await execute(conn, 'UPDATE `SIGE_DATOS_INGRESO` SET `ID_GRUPO` = ? WHERE PRE_REGISTRO = ?', [
              grupo.ID_GRUPO,
              alumno.PRE_REGISTRO,
            ]);
            asignados += 1;
          }
          cursor += grupo.CUPO;
        }
      }

      return {
        totalAlumnos: alumnosRows.length,
        asignados,
        sinGrupo: alumnosRows.length - asignados,
      };
    }),
});
