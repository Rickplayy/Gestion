# Pendientes de backend para el front nuevo

El front (rama `newFrontWithBack`) ya quedó sin modo mock, hablando directo contra
`http://localhost:3001/api/v1` (o `VITE_API_URL`). Le faltan 3 cosas al backend
para que todas las pantallas funcionen con datos reales. Las tres son cambios
pequeños, acotados, sin tocar nada de lo que ya existe.

## Cómo está organizado el backend (para seguir el mismo patrón)

Cada módulo en `src/modules/<nombre>/` tiene 5 archivos con una responsabilidad
fija cada uno. El flujo de una request siempre es:

```
routes.ts → controller.ts → service.ts → repository.ts → MySQL
   (registra la ruta   (llama al       (reglas de       (SQL puro,
    + schema Fastify)   service y       negocio,          nombres de
                        mapea el        valida con        tabla/columna
                        Result a HTTP)  repository)        en MAYÚSCULAS)
```

- **`*.schema.ts`**: los `Type.Object(...)` de TypeBox (validación + tipos
  TypeScript inferidos) y el objeto `xRouteSchema` que se le pasa a Fastify.
- **`*.repository.ts`**: funciones que reciben `db` (o `conn` dentro de una
  transacción) y hacen el `SELECT`/`INSERT`/`UPDATE` con `queryRows`/`queryOne`/
  `execute`/`withTransaction` (`src/infra/db/query.ts`). Nunca deciden códigos
  de error, solo devuelven datos o `null`.
- **`*.service.ts`**: valida existencia (`termExists`, etc.) y devuelve
  `Result<T, DomainError>` (`ok(...)` / `err(domainError(DomainErrorCode.NotFound, "..."))`,
  ver `src/shared/result` y `src/shared/errors`).
- **`*.controller.ts`**: llama al service, si `!result.ok` responde
  `errorToStatusCode(result.error.code)` + `{code, message}`, si no,
  `reply.status(200/201).send(result.value)`.
- **`*.routes.ts`**: registra la ruta con `{ schema, preHandler: [fastify.authenticate] }`
  (todo lleva auth excepto `/turns/carreras` y `/auth/login`).

Los nombres de tabla/columna deben coincidir EXACTO con el script SQL real
(mayúsculas, sin traducir). Las tablas relevantes para esto: `SIGE_CCARRERAS`,
`SIGE_GRUPOS`, `SIGE_DATOS_INGRESO`, `SIGE_INFO_DISTANCIA`, `SIGE_DOMICILIOS`.

---

## 1. `GET /terms/turns/carreras` — agregar total de alumnos, hombres y mujeres

**Por qué**: la vista de Carreras del front muestra 4 badges por carrera
(grupos, alumnos, hombres, mujeres); hoy `CarreraConGruposSchema` solo trae
`totalGrupos`.

**Dónde**: `src/modules/turns/`

No hace falta SQL nueva — el repository ya tiene `countByGenero(termId)`
(la usa `GET /terms/turns/alumnos/conteo`) que devuelve exactamente
`{idCarrera, descripcion, total, hombres, mujeres}` por carrera. Solo hay que
mezclarlo en el service:

```ts
// turns.schema.ts — agregar campos a CarreraConGruposSchema
export const CarreraConGruposSchema = Type.Object({
  id: Type.Integer(),
  descripcion: Type.String(),
  totalGrupos: Type.Integer(),
  totalAlumnos: Type.Integer(),
  hombres: Type.Integer(),
  mujeres: Type.Integer(),
});
```

```ts
// turns.service.ts — listCarrerasPorCiclo: combinar con countByGenero
listCarrerasPorCiclo: async (termId) => {
  if (!(await repository.termExists(termId))) {
    return err(domainError(DomainErrorCode.NotFound, TERM_NOT_FOUND));
  }

  const [carreras, conteo] = await Promise.all([
    repository.listCarrerasPorCiclo(termId),
    repository.countByGenero(termId),
  ]);

  const porId = new Map(conteo.carreras.map((c) => [c.idCarrera, c]));
  const items = carreras.map((c) => {
    const stats = porId.get(c.id);
    return {
      ...c,
      totalAlumnos: stats?.total ?? 0,
      hombres: stats?.hombres ?? 0,
      mujeres: stats?.mujeres ?? 0,
    };
  });

  return ok({ items });
},
```

No se toca `turns.repository.ts` ni `turns.controller.ts` ni `turns.routes.ts`.

---

## 2. `GET /terms/turns/alumnos` (`queryAlumnos`) — exponer `boleta`

**Por qué**: la tabla de alumnos por grupo en el front tiene columna Boleta.
El dato ya existe en `SIGE_DATOS_INGRESO.BOLETA` (se guarda desde
`createAlumnos`), simplemente no se selecciona ni se expone.

**Dónde**: `src/modules/turns/turns.schema.ts` y `turns.repository.ts`

```ts
// turns.schema.ts — AlumnoRowSchema
export const AlumnoRowSchema = Type.Object({
  pr: Type.String(),
  boleta: Type.Union([Type.String(), Type.Null()]), // <-- nuevo
  nombre: Type.String(),
  genero: Type.String(),
  // ...resto igual
});
```

```ts
// turns.repository.ts — AlumnoQueryRow: agregar BOLETA
type AlumnoQueryRow = RowDataPacket & {
  PRE_REGISTRO: string;
  BOLETA: string | null; // <-- nuevo
  NOMBRE: string;
  // ...resto igual
};
```

```ts
// turns.repository.ts — queryAlumnos: agregar d.BOLETA al SELECT
`SELECT d.PRE_REGISTRO, d.BOLETA, d.NOMBRE, d.GENERO, d.PROMEDIO, i.DISTANCIA_METROS,
        d.ID_CARRERA, c.DESCRIPCION AS CARRERA, d.ID_GRUPO, g.SECUENCIA, g.TURNO
 FROM \`SIGE_DATOS_INGRESO\` d
 ...`

// y en el mapeo del resultado:
return rows.map((row) => ({
  pr: row.PRE_REGISTRO,
  boleta: row.BOLETA, // <-- nuevo
  nombre: row.NOMBRE,
  // ...resto igual
}));
```

---

## 3. Endpoint nuevo: recalcular distancia por coordenadas manuales

**Por qué**: el modal de "Editar alumno" tiene dos formas de recalcular
distancia — por dirección (ya existe, `PATCH /terms/turns/alumnos/:pr/domicilio`)
y por coordenadas manuales (lat/lon directo), que **no existe todavía**.
El front ya llama a este endpoint (`src/api/client.js`, método
`updateDomicilioCoordenadas`, con un comentario `TODO(backend)` en el mismo
sitio) — solo hace falta implementarlo.

**Contrato esperado por el front**:

```
PATCH /terms/turns/alumnos/:pr/domicilio-coordenadas?termId=<id>
Body: { "lat": 19.396, "lon": -99.0919 }
200:  { "pr": "...", "distanceMeters": 1234.5, "nivel": 0 }
404:  { code, message }  (ciclo o alumno no existe)
```

**Diferencia clave con `updateDomicilio`**: ese endpoint busca la colonia por
CP/nombre (`matchColonia`) y saca lat/lon del catálogo `SIGE_CCOLONIAS`. Este
nuevo endpoint se salta ese matching — usa el lat/lon que manda el usuario
directamente contra OSRM. Tampoco toca `SIGE_DOMICILIOS` (no se está
corrigiendo la dirección registrada, solo overrideando el cálculo de
distancia), únicamente `SIGE_INFO_DISTANCIA`.

**Decisión de diseño a tomar**: el campo `NIVEL` en `SIGE_INFO_DISTANCIA` hoy
solo vale 1–4 (qué tan exacto fue el match de colonia: 1=exacto, 2=por CP,
3=municipio, 4=estado). Una coordenada manual no encaja en esa escala —
recomiendo agregar `NIVEL = 0` para "exacto, indicado a mano", así se
distingue en reportes de un match automático. Si prefieres otro criterio
(NULL, o un valor distinto), ajusta el mapeo pero mantén el tipo consistente
en schema + repository.

### Archivos a tocar

**`turns.schema.ts`** — agregar:

```ts
export const DomicilioCoordenadasBodySchema = Type.Object({
  lat: Type.Number({ minimum: -90, maximum: 90 }),
  lon: Type.Number({ minimum: -180, maximum: 180 }),
});

export const UpdateDomicilioCoordenadasResponseSchema = Type.Object({
  pr: Type.String(),
  distanceMeters: Type.Union([Type.Number(), Type.Null()]),
  nivel: Type.Union([
    Type.Literal(0), Type.Literal(1), Type.Literal(2),
    Type.Literal(3), Type.Literal(4), Type.Null(),
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
```

**`turns.repository.ts`** — nuevo método en `TurnsRepository`, hermano de
`updateDomicilio` pero sin `matchColonia`:

```ts
updateDomicilioCoordenadas: async (pr, termId, coords, reference) => {
  const alumno = await queryOne<IdRow>(
    db,
    'SELECT PRE_REGISTRO FROM `SIGE_DATOS_INGRESO` WHERE PRE_REGISTRO = ? AND ID_CICLO_ESCOLAR = ? LIMIT 1',
    [pr, termId],
  );
  if (alumno === null) {
    return null;
  }

  const route = await osrm.route({ lat: coords.lat, lon: coords.lon }, reference);
  const distancia = route !== null ? { metros: route.meters, nivel: 0 as const } : null;

  await withTransaction(db, async (conn) => {
    await execute(conn, 'DELETE FROM `SIGE_INFO_DISTANCIA` WHERE PRE_REGISTRO = ?', [pr]);
    if (distancia !== null) {
      await execute(
        conn,
        'INSERT INTO `SIGE_INFO_DISTANCIA` (`DISTANCIA_METROS`, `NIVEL`, `PRE_REGISTRO`) VALUES (?, ?, ?)',
        [distancia.metros, distancia.nivel, pr],
      );
    }
  });

  return { pr, distanceMeters: distancia?.metros ?? null, nivel: distancia?.nivel ?? null };
},
```

(Agregar la firma correspondiente a `TurnsRepository` y el tipo de retorno,
mismo estilo que `updateDomicilio: (...) => Promise<UpdateDomicilioResponse | null>`.)

**`turns.service.ts`** — mismo patrón que `updateDomicilio`:

```ts
updateDomicilioCoordenadas: async (pr, termId, coords) => {
  if (!(await repository.termExists(termId))) {
    return err(domainError(DomainErrorCode.NotFound, TERM_NOT_FOUND));
  }
  const result = await repository.updateDomicilioCoordenadas(pr, termId, coords, reference);
  if (result === null) {
    return err(domainError(DomainErrorCode.NotFound, ALUMNO_NOT_FOUND));
  }
  return ok(result);
},
```

**`turns.controller.ts`** — copiar el handler de `updateDomicilio`, cambiando
el nombre y el service method.

**`turns.routes.ts`** — registrar:

```ts
fastify.patch<{ Params: AlumnoPrParams; Querystring: TermIdQuery; Body: DomicilioCoordenadas }>(
  '/terms/turns/alumnos/:pr/domicilio-coordenadas',
  { schema: updateDomicilioCoordenadasRouteSchema, preHandler: [fastify.authenticate] },
  controller.updateDomicilioCoordenadas,
);
```

---

## Lo que YA funciona y no necesita cambios

`POST /auth/login`, `GET /turns/carreras`, `GET /terms` (ya incluye
`carreras[]` por ciclo), `POST /terms`, `GET /terms/turns/grupos`,
`POST /terms/turns/grupos`, `POST /terms/turns/alumnos`,
`PATCH /terms/turns/alumnos/:pr/domicilio`, `PATCH /terms/turns/alumnos/:pr/grupo`,
`GET /terms/turns/alumnos/conteo`, `GET /terms/turns/grupos/asignar`.

En particular: el modal de edición llama a `asignarGrupos(termId)` (el
endpoint que ya existe) después de cualquier recálculo de distancia, para que
se reacomoden los grupos de la carrera — no hace falta una versión "solo esta
carrera", ese endpoint ya reparte por carrera internamente y no toca las
carreras que no cambiaron.

## Verificar al terminar

```bash
cd Backend
npm run typecheck
npm run lint
```

Y desde el front (`Frontend/.env` con `VITE_API_URL` apuntando al backend
local), probar: Ciclos → Carreras (badges de alumnos/hombres/mujeres) →
Grupos → tabla de Alumnos (columna Boleta) → botón Editar → las dos pestañas
de "Recalcular".
