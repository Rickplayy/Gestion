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

export type CreateTermBody = Static<typeof CreateTermBodySchema>;
export type TermDto = Static<typeof TermSchema>;
