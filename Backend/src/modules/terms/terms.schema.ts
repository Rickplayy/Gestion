import { Type, type Static } from '@sinclair/typebox';

export const CreateTermBodySchema = Type.Object({
  descripcion: Type.String({ minLength: 1, maxLength: 50 }),
});

export const TermSchema = Type.Object({
  id: Type.Integer(),
  descripcion: Type.String(),
});

export const ErrorResponseSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
});

export const createTermRouteSchema = {
  body: CreateTermBodySchema,
  response: {
    201: TermSchema,
    400: ErrorResponseSchema,
    409: ErrorResponseSchema,
  },
};

export const TermCarreraSchema = Type.Object({
  id: Type.Integer(),
  descripcion: Type.String(),
});

export const TermWithCarrerasSchema = Type.Object({
  id: Type.Integer(),
  descripcion: Type.String(),
  carreras: Type.Array(TermCarreraSchema),
});

export const TermsResponseSchema = Type.Object({
  items: Type.Array(TermWithCarrerasSchema),
});

export const listTermsRouteSchema = {
  response: {
    200: TermsResponseSchema,
  },
};

export type CreateTermBody = Static<typeof CreateTermBodySchema>;
export type TermDto = Static<typeof TermSchema>;
export type TermWithCarreras = Static<typeof TermWithCarrerasSchema>;
export type TermsResponse = Static<typeof TermsResponseSchema>;

export const TermIdParamsSchema = Type.Object({
  termId: Type.Integer({ minimum: 1 }),
});

export const DeleteTermResponseSchema = Type.Object({
  id: Type.Integer(),
});

export const deleteTermRouteSchema = {
  params: TermIdParamsSchema,
  response: {
    200: DeleteTermResponseSchema,
    404: ErrorResponseSchema,
  },
};

export type TermIdParams = Static<typeof TermIdParamsSchema>;
export type DeleteTermResponse = Static<typeof DeleteTermResponseSchema>;
