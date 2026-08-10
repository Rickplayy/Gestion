import { http } from './http';
import type {
  AlumnoDomicilio,
  AlumnoRegistroInput,
  AlumnosQueryFilters,
  AlumnosQueryResponse,
  AsignarGruposResponse,
  Carrera,
  CarreraConGrupos,
  ConteoAlumnosResponse,
  CreateAlumnosResponse,
  DomicilioCoordenadas,
  DomicilioRegistro,
  GrupoConAlumnos,
  GrupoCreated,
  GrupoInput,
  Term,
  UpdateDomicilioCoordenadasResponse,
  UpdateDomicilioResponse,
  UpdateGrupoResponse,
} from '@/types/api';

export const api = {
  login: (username: string, password: string) =>
    http.post<{ token: string }>('/auth/login', { username, password }).then((r) => r.data),

  getCarreras: () => http.get<{ items: Carrera[] }>('/turns/carreras').then((r) => r.data),

  listTerms: () => http.get<{ items: Term[] }>('/terms').then((r) => r.data),

  createTerm: (descripcion: string) =>
    http.post<{ id: number; descripcion: string }>('/terms', { descripcion }).then((r) => r.data),

  deleteTerm: (termId: number) =>
    http.delete<{ id: number }>(`/terms/${termId}`).then((r) => r.data),

  getCarrerasPorCiclo: (termId: number) =>
    http
      .get<{ items: CarreraConGrupos[] }>(`/terms/turns/carreras?termId=${termId}`)
      .then((r) => r.data),

  getGruposPorCarrera: (termId: number, idCarrera: number) =>
    http
      .get<{ items: GrupoConAlumnos[] }>(
        `/terms/turns/grupos?termId=${termId}&carrera=${idCarrera}`,
      )
      .then((r) => r.data),

  createGrupos: (termId: number, grupos: GrupoInput[]) =>
    http
      .post<{ items: GrupoCreated[] }>(`/terms/turns/grupos?termId=${termId}`, grupos)
      .then((r) => r.data),

  createAlumnos: (termId: number, alumnos: AlumnoRegistroInput[]) =>
    http
      .post<CreateAlumnosResponse>(`/terms/turns/alumnos?termId=${termId}`, alumnos)
      .then((r) => r.data),

  queryAlumnos: (termId: number, filters: AlumnosQueryFilters = {}) => {
    const params = new URLSearchParams();
    params.set('termId', String(termId));
    for (const s of filters.secuencia ?? []) params.append('secuencia', s);
    for (const c of filters.carrera ?? []) params.append('carrera', String(c));
    if (filters.sinAsignar !== undefined) params.set('sinAsignar', String(filters.sinAsignar));
    return http
      .get<AlumnosQueryResponse>(`/terms/turns/alumnos?${params.toString()}`)
      .then((r) => r.data);
  },

  getDomicilio: (termId: number, pr: string) =>
    http
      .get<AlumnoDomicilio>(
        `/terms/turns/alumnos/${encodeURIComponent(pr)}/domicilio?termId=${termId}`,
      )
      .then((r) => r.data),

  updateDomicilio: (termId: number, pr: string, domicilio: DomicilioRegistro) =>
    http
      .patch<UpdateDomicilioResponse>(
        `/terms/turns/alumnos/${encodeURIComponent(pr)}/domicilio?termId=${termId}`,
        domicilio,
      )
      .then((r) => r.data),

  updateDomicilioCoordenadas: (termId: number, pr: string, coords: DomicilioCoordenadas) =>
    http
      .patch<UpdateDomicilioCoordenadasResponse>(
        `/terms/turns/alumnos/${encodeURIComponent(pr)}/domicilio-coordenadas?termId=${termId}`,
        coords,
      )
      .then((r) => r.data),

  updateGrupoAlumno: (termId: number, pr: string, idGrupo: number | null) =>
    http
      .patch<UpdateGrupoResponse>(
        `/terms/turns/alumnos/${encodeURIComponent(pr)}/grupo?termId=${termId}`,
        {
          idGrupo,
        },
      )
      .then((r) => r.data),

  getConteo: (termId: number) =>
    http
      .get<ConteoAlumnosResponse>(`/terms/turns/alumnos/conteo?termId=${termId}`)
      .then((r) => r.data),

  asignarGrupos: (termId: number) =>
    http
      .get<AsignarGruposResponse>(`/terms/turns/grupos/asignar?termId=${termId}`)
      .then((r) => r.data),
};
