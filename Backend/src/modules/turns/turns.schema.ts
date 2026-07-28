import { Type, type Static } from '@sinclair/typebox';

export const ErrorResponseSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
});

export const TermIdQuerySchema = Type.Object({
  termId: Type.Integer({ minimum: 1 }),
});

export type TermIdQuery = Static<typeof TermIdQuerySchema>;

// --- Carreras (catálogo) ---

export const CarreraSchema = Type.Object({
  id: Type.Integer(),
  descripcion: Type.String(),
});

export const CarrerasResponseSchema = Type.Object({
  items: Type.Array(CarreraSchema),
});

export const listCarrerasRouteSchema = {
  response: {
    200: CarrerasResponseSchema,
  },
};

export type Carrera = Static<typeof CarreraSchema>;
export type CarrerasResponse = Static<typeof CarrerasResponseSchema>;

// --- Grupos ---

export const GrupoInputSchema = Type.Object({
  secuencia: Type.String({ minLength: 1, maxLength: 5 }),
  cupo: Type.Integer({ minimum: 1 }),
  turno: Type.Union([Type.Literal('M'), Type.Literal('V')]),
  carrera: Type.Integer({ minimum: 1 }),
});

export const CreateGruposBodySchema = Type.Array(GrupoInputSchema, { minItems: 1 });

export const GrupoCreatedSchema = Type.Object({
  id: Type.Integer(),
  secuencia: Type.String(),
  cupo: Type.Integer(),
  turno: Type.String(),
  idCarrera: Type.Integer(),
});

export const CreateGruposResponseSchema = Type.Object({
  items: Type.Array(GrupoCreatedSchema),
});

export const createGruposRouteSchema = {
  querystring: TermIdQuerySchema,
  body: CreateGruposBodySchema,
  response: {
    201: CreateGruposResponseSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
    409: ErrorResponseSchema,
  },
};

export const GrupoAlumnoSchema = Type.Object({
  pr: Type.String(),
  nombre: Type.String(),
  genero: Type.String(),
  promedio: Type.Union([Type.Number(), Type.Null()]),
  distanceMeters: Type.Union([Type.Number(), Type.Null()]),
});

export const GrupoListItemSchema = Type.Object({
  id: Type.Integer(),
  secuencia: Type.String(),
  cupo: Type.Integer(),
  turno: Type.String(),
  idCarrera: Type.Integer(),
  carrera: Type.String(),
  alumnos: Type.Array(GrupoAlumnoSchema),
});

export const ListGruposResponseSchema = Type.Object({
  items: Type.Array(GrupoListItemSchema),
});

export const listGruposRouteSchema = {
  querystring: TermIdQuerySchema,
  response: {
    200: ListGruposResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type GrupoInput = Static<typeof GrupoInputSchema>;
export type CreateGruposBody = Static<typeof CreateGruposBodySchema>;
export type GrupoCreated = Static<typeof GrupoCreatedSchema>;
export type GrupoAlumno = Static<typeof GrupoAlumnoSchema>;
export type GrupoListItem = Static<typeof GrupoListItemSchema>;
export type ListGruposResponse = Static<typeof ListGruposResponseSchema>;
export type CreateGruposResponse = Static<typeof CreateGruposResponseSchema>;

// --- Registro de alumnos (persistido) ---

export const DomicilioRegistroSchema = Type.Object({
  CALLE: Type.String(),
  NUMERO: Type.String(),
  COLONIA: Type.String(),
  DELEGACION: Type.String(),
  CP: Type.String(),
  ESTADO: Type.String(),
});

export const AlumnoRegistroInputSchema = Type.Object({
  BOLETA: Type.Union([Type.String(), Type.Null()]),
  PR: Type.String({ minLength: 1, maxLength: 10 }),
  CURP: Type.String(),
  NOMBRE: Type.String(),
  DOMICILIO: DomicilioRegistroSchema,
  FECHA_NACIMIENTO: Type.String(),
  SEXO: Type.String(),
  PROGRAMA_EDUCATIVO: Type.Integer(),
  ESCUELA_PROCEDENCIA: Type.String(),
  ENTIDAD_ESCUELA: Type.String(),
  EMAIL: Type.String(),
  ESTATUS: Type.Integer(),
  PROMEDIO: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  FOLIO: Type.Integer(),
});

export const CreateAlumnosBodySchema = Type.Array(AlumnoRegistroInputSchema, { minItems: 1 });

export const AlumnoFallidoSchema = Type.Object({
  pr: Type.String(),
  motivo: Type.String(),
});

export const CreateAlumnosResponseSchema = Type.Object({
  total: Type.Integer(),
  insertados: Type.Integer(),
  duplicados: Type.Array(Type.String()),
  fallidos: Type.Array(AlumnoFallidoSchema),
});

export const createAlumnosRouteSchema = {
  querystring: TermIdQuerySchema,
  body: CreateAlumnosBodySchema,
  response: {
    201: CreateAlumnosResponseSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type DomicilioRegistro = Static<typeof DomicilioRegistroSchema>;
export type AlumnoRegistroInput = Static<typeof AlumnoRegistroInputSchema>;
export type CreateAlumnosBody = Static<typeof CreateAlumnosBodySchema>;
export type AlumnoFallido = Static<typeof AlumnoFallidoSchema>;
export type CreateAlumnosResponse = Static<typeof CreateAlumnosResponseSchema>;

// --- Conteo ---

export const ConteoCarreraSchema = Type.Object({
  idCarrera: Type.Integer(),
  descripcion: Type.String(),
  total: Type.Integer(),
  hombres: Type.Integer(),
  mujeres: Type.Integer(),
});

export const ConteoAlumnosResponseSchema = Type.Object({
  carreras: Type.Array(ConteoCarreraSchema),
  total: Type.Integer(),
  hombres: Type.Integer(),
  mujeres: Type.Integer(),
});

export const conteoAlumnosRouteSchema = {
  querystring: TermIdQuerySchema,
  response: {
    200: ConteoAlumnosResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type ConteoCarrera = Static<typeof ConteoCarreraSchema>;
export type ConteoAlumnosResponse = Static<typeof ConteoAlumnosResponseSchema>;

// --- Asignación de grupos ---

export const AsignarGruposResponseSchema = Type.Object({
  totalAlumnos: Type.Integer(),
  asignados: Type.Integer(),
  sinGrupo: Type.Integer(),
});

export const asignarGruposRouteSchema = {
  querystring: TermIdQuerySchema,
  response: {
    200: AsignarGruposResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type AsignarGruposResponse = Static<typeof AsignarGruposResponseSchema>;
