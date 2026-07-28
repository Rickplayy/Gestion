import type { GeoPoint } from '../../infra/geo/osrm.client.js';
import type { TurnsRepository } from './turns.repository.js';
import { ok, err, type Result } from '../../shared/result/index.js';
import { domainError, DomainErrorCode, type DomainError } from '../../shared/errors/index.js';
import type {
  AlumnoFallido,
  AlumnoRegistroInput,
  AsignarGruposResponse,
  CarrerasResponse,
  ConteoAlumnosResponse,
  CreateAlumnosResponse,
  CreateGruposResponse,
  GrupoInput,
  ListGruposResponse,
} from './turns.schema.js';

export type TurnsService = {
  listCarreras: () => Promise<Result<CarrerasResponse, DomainError>>;
  createGrupos: (
    termId: number,
    grupos: GrupoInput[],
  ) => Promise<Result<CreateGruposResponse, DomainError>>;
  listGrupos: (termId: number) => Promise<Result<ListGruposResponse, DomainError>>;
  createAlumnos: (
    termId: number,
    alumnos: AlumnoRegistroInput[],
  ) => Promise<Result<CreateAlumnosResponse, DomainError>>;
  countAlumnos: (termId: number) => Promise<Result<ConteoAlumnosResponse, DomainError>>;
  assignGroups: (termId: number) => Promise<Result<AsignarGruposResponse, DomainError>>;
};

const WORK_CONCURRENCY = 10;
const TERM_NOT_FOUND = 'El ciclo escolar indicado no existe';

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array<R>(items.length);
  let index = 0;

  const worker = async (): Promise<void> => {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current]!);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
};

export const createTurnsService = (
  repository: TurnsRepository,
  reference: GeoPoint,
): TurnsService => ({
  listCarreras: async () => {
    const items = await repository.listCarreras();
    return ok({ items });
  },

  createGrupos: async (termId, grupos) => {
    if (!(await repository.termExists(termId))) {
      return err(domainError(DomainErrorCode.NotFound, TERM_NOT_FOUND));
    }

    const seen = new Set<string>();
    const duplicadosEnLote = new Set<string>();
    for (const grupo of grupos) {
      if (seen.has(grupo.secuencia)) {
        duplicadosEnLote.add(grupo.secuencia);
      }
      seen.add(grupo.secuencia);
    }
    if (duplicadosEnLote.size > 0) {
      return err(
        domainError(
          DomainErrorCode.Conflict,
          `Secuencia(s) repetida(s) en la petición: ${[...duplicadosEnLote].join(', ')}`,
        ),
      );
    }

    const existentes = await repository.findExistingSecuencias(
      termId,
      grupos.map((grupo) => grupo.secuencia),
    );
    if (existentes.length > 0) {
      return err(
        domainError(
          DomainErrorCode.Conflict,
          `Ya existe(n) en este ciclo escolar: ${existentes.join(', ')}`,
        ),
      );
    }

    const created = await repository.insertGrupos(termId, grupos);
    return ok({ items: created });
  },

  listGrupos: async (termId) => {
    if (!(await repository.termExists(termId))) {
      return err(domainError(DomainErrorCode.NotFound, TERM_NOT_FOUND));
    }

    const items = await repository.listGrupos(termId);
    return ok({ items });
  },

  createAlumnos: async (termId, alumnos) => {
    if (!(await repository.termExists(termId))) {
      return err(domainError(DomainErrorCode.NotFound, TERM_NOT_FOUND));
    }

    const outcomes = await mapWithConcurrency(alumnos, WORK_CONCURRENCY, (alumno) =>
      repository.insertAlumno(termId, alumno, reference),
    );

    let insertados = 0;
    const duplicados: string[] = [];
    const fallidos: AlumnoFallido[] = [];

    outcomes.forEach((outcome, index) => {
      const pr = alumnos[index]!.PR;
      if (outcome.status === 'inserted') {
        insertados += 1;
      } else if (outcome.status === 'duplicate') {
        duplicados.push(pr);
      } else {
        fallidos.push({ pr, motivo: outcome.motivo });
      }
    });

    return ok({ total: alumnos.length, insertados, duplicados, fallidos });
  },

  countAlumnos: async (termId) => {
    if (!(await repository.termExists(termId))) {
      return err(domainError(DomainErrorCode.NotFound, TERM_NOT_FOUND));
    }

    const conteo = await repository.countByGenero(termId);
    return ok(conteo);
  },

  assignGroups: async (termId) => {
    if (!(await repository.termExists(termId))) {
      return err(domainError(DomainErrorCode.NotFound, TERM_NOT_FOUND));
    }

    const result = await repository.assignGroups(termId);
    return ok(result);
  },
});
