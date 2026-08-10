import type { AuthRepository } from './auth.repository.js';
import { ok, err, type Result } from '../../shared/result/index.js';
import { verifyPassword } from '../../shared/crypto/password.js';
import { domainError, DomainErrorCode, type DomainError } from '../../shared/errors/index.js';
import type { AccessTokenPayload, LoginBody, LoginResponse } from './auth.schema.js';

export type TokenSigner = (payload: AccessTokenPayload) => string;

export type AuthService = {
  login: (body: LoginBody) => Promise<Result<LoginResponse, DomainError>>;
};

const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos';

export const createAuthService = (
  repository: AuthRepository,
  sign: TokenSigner,
): AuthService => ({
  login: async (body) => {
    const admin = await repository.findByUsername(body.username);
    if (admin === null) {
      return err(domainError(DomainErrorCode.Unauthorized, INVALID_CREDENTIALS));
    }

    const passwordMatches = await verifyPassword(body.password, admin.password);
    if (!passwordMatches) {
      return err(domainError(DomainErrorCode.Unauthorized, INVALID_CREDENTIALS));
    }

    const token = sign({ sub: admin.id, username: admin.username });
    return ok({ token });
  },
});
