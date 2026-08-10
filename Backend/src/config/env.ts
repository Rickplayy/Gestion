import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const EnvSchema = Type.Object({
  NODE_ENV: Type.Union(
    [Type.Literal('development'), Type.Literal('production'), Type.Literal('test')],
    { default: 'development' },
  ),
  HOST: Type.String({ default: '0.0.0.0', minLength: 1 }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3001 }),
  DB_HOST: Type.String({ minLength: 1 }),
  DB_PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3306 }),
  DB_USER: Type.String({ minLength: 1 }),
  DB_PASSWORD: Type.String(),
  DB_NAME: Type.String({ minLength: 1 }),
  DB_CONNECTION_LIMIT: Type.Integer({ minimum: 1, maximum: 1000, default: 10 }),
  JWT_SECRET: Type.String({ minLength: 16 }),
  JWT_EXPIRY: Type.String({ default: '1h', minLength: 1 }),
  FRONTEND_ORIGIN: Type.String({ default: '' }),
  OSRM_URL: Type.String({ default: 'http://localhost:5000', minLength: 1 }),
  UPIICSA_LAT: Type.Number({ minimum: -90, maximum: 90 }),
  UPIICSA_LON: Type.Number({ minimum: -180, maximum: 180 }),
  ADMIN_USER: Type.String({ default: 'admin', minLength: 1 }),
  ADMIN_PASS: Type.Optional(Type.String()),
});

export type Env = Static<typeof EnvSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const withDefaults = Value.Default(EnvSchema, { ...source });
  const converted = Value.Convert(EnvSchema, withDefaults);

  if (!Value.Check(EnvSchema, converted)) {
    const messages = [...Value.Errors(EnvSchema, converted)]
      .map((issue) => `${issue.path || '/'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  return converted;
};
