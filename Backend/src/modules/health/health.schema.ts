import { Type, type Static } from '@sinclair/typebox';

export const DependencyStatusSchema = Type.Union([Type.Literal('up'), Type.Literal('down')]);

export const HealthResponseSchema = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('degraded')]),
  uptime: Type.Number(),
  timestamp: Type.String({ format: 'date-time' }),
  dependencies: Type.Object({
    database: DependencyStatusSchema,
  }),
});

export type HealthResponse = Static<typeof HealthResponseSchema>;

export const healthRouteSchema = {
  response: {
    200: HealthResponseSchema,
    503: HealthResponseSchema,
  },
};
