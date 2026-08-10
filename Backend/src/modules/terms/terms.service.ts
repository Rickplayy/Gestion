import type { TermsRepository } from './terms.repository.js';
import { ok, err, type Result } from '../../shared/result/index.js';
import { domainError, DomainErrorCode, type DomainError } from '../../shared/errors/index.js';
import type { CreateTermBody, DeleteTermResponse, TermDto, TermsResponse } from './terms.schema.js';

export type TermsService = {
  create: (body: CreateTermBody) => Promise<Result<TermDto, DomainError>>;
  list: () => Promise<Result<TermsResponse, DomainError>>;
  deleteTerm: (termId: number) => Promise<Result<DeleteTermResponse, DomainError>>;
};

const DESCRIPCION_TAKEN = 'Ya existe un ciclo escolar con esa descripción';
const TERM_NOT_FOUND = 'El ciclo escolar indicado no existe';

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

  deleteTerm: async (termId) => {
    if (!(await repository.existsById(termId))) {
      return err(domainError(DomainErrorCode.NotFound, TERM_NOT_FOUND));
    }

    await repository.deleteTerm(termId);
    return ok({ id: termId });
  },
});
