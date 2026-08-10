export type Carrera = {
  id: number;
  descripcion: string;
};

export type Term = {
  id: number;
  descripcion: string;
  carreras: Carrera[];
};

export type CarreraConGrupos = {
  id: number;
  descripcion: string;
  totalGrupos: number;
  totalAlumnos: number;
  hombres: number;
  mujeres: number;
};

export type Turno = 'M' | 'V';

export type Grupo = {
  id: number;
  secuencia: string;
  cupo: number;
  turno: Turno;
};

export type GrupoConAlumnos = Grupo & {
  totalAlumnos: number;
};

export type GrupoInput = {
  secuencia: string;
  cupo: number;
  turno: Turno;
  carrera: number;
};

export type GrupoCreated = {
  id: number;
  secuencia: string;
  cupo: number;
  turno: string;
  idCarrera: number;
};

export type DomicilioRegistro = {
  CALLE: string;
  NUMERO: string;
  COLONIA: string;
  DELEGACION: string;
  CP: string;
  ESTADO: string;
};

export type AlumnoRegistroInput = {
  BOLETA: string | null;
  PR: string;
  CURP: string;
  NOMBRE: string;
  DOMICILIO: DomicilioRegistro;
  FECHA_NACIMIENTO: string;
  SEXO: string;
  PROGRAMA_EDUCATIVO: number;
  ESCUELA_PROCEDENCIA: string;
  ENTIDAD_ESCUELA: string;
  EMAIL: string;
  ESTATUS: number;
  PROMEDIO?: number | null;
  FOLIO: number;
};

export type CreateAlumnosResponse = {
  total: number;
  insertados: number;
  duplicados: string[];
  fallidos: { pr: string; motivo: string }[];
};

export type AlumnosQueryFilters = {
  secuencia?: string[];
  carrera?: number[];
  sinAsignar?: boolean;
};

export type AlumnoRow = {
  pr: string;
  boleta: string | null;
  nombre: string;
  genero: string;
  promedio: number | null;
  distanceMeters: number | null;
  idCarrera: number;
  carrera: string;
  idGrupo: number | null;
  secuencia: string | null;
  turno: string | null;
};

export type AlumnosQueryResponse = {
  items: AlumnoRow[];
  total: number;
};

export type NivelDistancia = 0 | 1 | 2 | 3 | 4 | null;

export type UpdateDomicilioResponse = {
  pr: string;
  domicilio: DomicilioRegistro;
  distanceMeters: number | null;
  nivel: NivelDistancia;
};

export type DomicilioCoordenadas = {
  lat: number;
  lon: number;
};

export type UpdateDomicilioCoordenadasResponse = {
  pr: string;
  distanceMeters: number | null;
  nivel: NivelDistancia;
};

export type AlumnoDomicilio = {
  pr: string;
  calle: string | null;
  numero: string | null;
  colonia: string | null;
  delegacion: string | null;
  estado: string | null;
  cp: string | null;
  lat: number | null;
  lon: number | null;
};

export type UpdateGrupoResponse = {
  pr: string;
  idGrupo: number | null;
};

export type ConteoCarrera = {
  idCarrera: number;
  descripcion: string;
  total: number;
  hombres: number;
  mujeres: number;
};

export type ConteoAlumnosResponse = {
  carreras: ConteoCarrera[];
  total: number;
  hombres: number;
  mujeres: number;
};

export type AsignarGruposResponse = {
  totalAlumnos: number;
  asignados: number;
  sinGrupo: number;
};

export type ApiErrorBody = {
  code: string;
  message: string;
};
