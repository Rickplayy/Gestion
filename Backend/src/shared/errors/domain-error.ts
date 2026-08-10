export const DomainErrorCode = {
  Internal: 'INTERNAL',
  Validation: 'VALIDATION',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export type DomainError = {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly details?: unknown;
};

export const domainError = (
  code: DomainErrorCode,
  message: string,
  details?: unknown,
): DomainError => ({
  code,
  message,
  ...(details === undefined ? {} : { details }),
});

export const errorToStatusCode = (code: DomainErrorCode): number => {
  switch (code) {
    case DomainErrorCode.Validation:
      return 400;
    case DomainErrorCode.Unauthorized:
      return 401;
    case DomainErrorCode.Forbidden:
      return 403;
    case DomainErrorCode.NotFound:
      return 404;
    case DomainErrorCode.Conflict:
      return 409;
    case DomainErrorCode.ServiceUnavailable:
      return 503;
    case DomainErrorCode.Internal:
      return 500;
  }
};
