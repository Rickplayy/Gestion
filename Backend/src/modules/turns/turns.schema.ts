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

// --- Carreras con número de grupos, por ciclo escolar ---

export const CarreraConGruposSchema = Type.Object({
  id: Type.Integer(),
  descripcion: Type.String(),
  totalGrupos: Type.Integer(),
  totalAlumnos: Type.Integer(),
  hombres: Type.Integer(),
  mujeres: Type.Integer(),
});

export const CarrerasConGruposResponseSchema = Type.Object({
  items: Type.Array(CarreraConGruposSchema),
});

export const listCarrerasPorCicloRouteSchema = {
  querystring: TermIdQuerySchema,
  response: {
    200: CarrerasConGruposResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type CarreraConGrupos = Static<typeof CarreraConGruposSchema>;
export type CarrerasConGruposResponse = Static<typeof CarrerasConGruposResponseSchema>;

// --- Grupos con número de alumnos, por ciclo escolar + carrera ---

export const GruposPorCarreraQuerySchema = Type.Object({
  termId: Type.Integer({ minimum: 1 }),
  carrera: Type.Integer({ minimum: 1 }),
});

export const GrupoConAlumnosSchema = Type.Object({
  id: Type.Integer(),
  secuencia: Type.String(),
  cupo: Type.Integer(),
  turno: Type.String(),
  totalAlumnos: Type.Integer(),
});

export const GruposConAlumnosResponseSchema = Type.Object({
  items: Type.Array(GrupoConAlumnosSchema),
});

export const listGruposPorCarreraRouteSchema = {
  querystring: GruposPorCarreraQuerySchema,
  response: {
    200: GruposConAlumnosResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type GruposPorCarreraQuery = Static<typeof GruposPorCarreraQuerySchema>;
export type GrupoConAlumnos = Static<typeof GrupoConAlumnosSchema>;
export type GruposConAlumnosResponse = Static<typeof GruposConAlumnosResponseSchema>;

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

export type GrupoInput = Static<typeof GrupoInputSchema>;
export type CreateGruposBody = Static<typeof CreateGruposBodySchema>;
export type GrupoCreated = Static<typeof GrupoCreatedSchema>;
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

// --- Edición puntual de un alumno ---

export const AlumnoPrParamsSchema = Type.Object({
  pr: Type.String({ minLength: 1 }),
});

export type AlumnoPrParams = Static<typeof AlumnoPrParamsSchema>;

export const UpdateDomicilioResponseSchema = Type.Object({
  pr: Type.String(),
  domicilio: DomicilioRegistroSchema,
  distanceMeters: Type.Union([Type.Number(), Type.Null()]),
  nivel: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3), Type.Literal(4), Type.Null()]),
});

export const updateDomicilioRouteSchema = {
  params: AlumnoPrParamsSchema,
  querystring: TermIdQuerySchema,
  body: DomicilioRegistroSchema,
  response: {
    200: UpdateDomicilioResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type UpdateDomicilioResponse = Static<typeof UpdateDomicilioResponseSchema>;

// --- Consulta del domicilio actual (para precargar el modal de edición) ---

export const AlumnoDomicilioResponseSchema = Type.Object({
  pr: Type.String(),
  calle: Type.Union([Type.String(), Type.Null()]),
  numero: Type.Union([Type.String(), Type.Null()]),
  colonia: Type.Union([Type.String(), Type.Null()]),
  delegacion: Type.Union([Type.String(), Type.Null()]),
  estado: Type.Union([Type.String(), Type.Null()]),
  cp: Type.Union([Type.String(), Type.Null()]),
  lat: Type.Union([Type.Number(), Type.Null()]),
  lon: Type.Union([Type.Number(), Type.Null()]),
});

export const getAlumnoDomicilioRouteSchema = {
  params: AlumnoPrParamsSchema,
  querystring: TermIdQuerySchema,
  response: {
    200: AlumnoDomicilioResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type AlumnoDomicilioResponse = Static<typeof AlumnoDomicilioResponseSchema>;

export const DomicilioCoordenadasBodySchema = Type.Object({
  lat: Type.Number({ minimum: -90, maximum: 90 }),
  lon: Type.Number({ minimum: -180, maximum: 180 }),
});

export const UpdateDomicilioCoordenadasResponseSchema = Type.Object({
  pr: Type.String(),
  distanceMeters: Type.Union([Type.Number(), Type.Null()]),
  nivel: Type.Union([
    Type.Literal(0),
    Type.Literal(1),
    Type.Literal(2),
    Type.Literal(3),
    Type.Literal(4),
    Type.Null(),
  ]),
});

export const updateDomicilioCoordenadasRouteSchema = {
  params: AlumnoPrParamsSchema,
  querystring: TermIdQuerySchema,
  body: DomicilioCoordenadasBodySchema,
  response: {
    200: UpdateDomicilioCoordenadasResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type DomicilioCoordenadas = Static<typeof DomicilioCoordenadasBodySchema>;
export type UpdateDomicilioCoordenadasResponse = Static<typeof UpdateDomicilioCoordenadasResponseSchema>;

export const UpdateGrupoBodySchema = Type.Object({
  idGrupo: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
});

export const UpdateGrupoResponseSchema = Type.Object({
  pr: Type.String(),
  idGrupo: Type.Union([Type.Integer(), Type.Null()]),
});

export const updateGrupoRouteSchema = {
  params: AlumnoPrParamsSchema,
  querystring: TermIdQuerySchema,
  body: UpdateGrupoBodySchema,
  response: {
    200: UpdateGrupoResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type UpdateGrupoBody = Static<typeof UpdateGrupoBodySchema>;
export type UpdateGrupoResponse = Static<typeof UpdateGrupoResponseSchema>;

// --- Consulta de alumnos con filtros (secuencia, carrera, sin asignar) ---

export const AlumnosQuerySchema = Type.Object({
  termId: Type.Integer({ minimum: 1 }),
  secuencia: Type.Optional(Type.Array(Type.String())),
  carrera: Type.Optional(Type.Array(Type.Integer())),
  sinAsignar: Type.Optional(Type.Boolean()),
});

export type AlumnosQuery = Static<typeof AlumnosQuerySchema>;

export const AlumnoRowSchema = Type.Object({
  pr: Type.String(),
  boleta: Type.Union([Type.String(), Type.Null()]),
  nombre: Type.String(),
  genero: Type.String(),
  promedio: Type.Union([Type.Number(), Type.Null()]),
  distanceMeters: Type.Union([Type.Number(), Type.Null()]),
  idCarrera: Type.Integer(),
  carrera: Type.String(),
  idGrupo: Type.Union([Type.Integer(), Type.Null()]),
  secuencia: Type.Union([Type.String(), Type.Null()]),
  turno: Type.Union([Type.String(), Type.Null()]),
});

export const AlumnosQueryResponseSchema = Type.Object({
  items: Type.Array(AlumnoRowSchema),
  total: Type.Integer(),
});

export const queryAlumnosRouteSchema = {
  querystring: AlumnosQuerySchema,
  response: {
    200: AlumnosQueryResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type AlumnoRow = Static<typeof AlumnoRowSchema>;
export type AlumnosQueryResponse = Static<typeof AlumnosQueryResponseSchema>;
