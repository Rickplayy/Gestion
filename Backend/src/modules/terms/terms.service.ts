import type { TermsRepository } from './terms.repository.js';
import { ok, err, type Result } from '../../shared/result/index.js';
import { domainError, DomainErrorCode, type DomainError } from '../../shared/errors/index.js';
import type { CreateTermBody, TermDto, TermsResponse } from './terms.schema.js';

export type TermsService = {
  create: (body: CreateTermBody) => Promise<Result<TermDto, DomainError>>;
  list: () => Promise<Result<TermsResponse, DomainError>>;
};

const DESCRIPCION_TAKEN = 'Ya existe un ciclo escolar con esa descripción';

export const createTermsService = (repository: TermsRepository): TermsService => ({
  create: async (body) => {
    if (await repository.existsByDescripcion(body.descripcion)) {
      return err(domainError(DomainErrorCode.Conflict, DESCRIPCION_TAKEN));
    }

    const term = await repository.create(body.descripcion);
    return ok(term);
  },

  list: async () => {
    const items = await repository.listAll();
    return ok({ items });
  },
});
