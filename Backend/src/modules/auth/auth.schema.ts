import { Type, type Static } from '@sinclair/typebox';

export const LoginBodySchema = Type.Object({
  username: Type.String({ minLength: 1, maxLength: 128 }),
  password: Type.String({ minLength: 1, maxLength: 512 }),
});

export const LoginResponseSchema = Type.Object({
  token: Type.String(),
});

export const ErrorResponseSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
});

export const loginRouteSchema = {
  body: LoginBodySchema,
  response: {
    200: LoginResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
};

export type LoginBody = Static<typeof LoginBodySchema>;
export type LoginResponse = Static<typeof LoginResponseSchema>;

export type AccessTokenPayload = {
  sub: number;
  username: string;
};
