import { mockApi } from './mockClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const TOKEN_KEY = 'sige_token';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) setToken(null);
    throw new Error(data?.message || `Error ${response.status}`);
  }

  return data;
}

const realApi = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  getCarreras: () => request('/turns/carreras', { auth: false }),
  listTerms: () => request('/terms'),
  createTerm: (descripcion) => request('/terms', { method: 'POST', body: { descripcion } }),
  getCarrerasPorCiclo: (termId) => request(`/terms/turns/carreras?termId=${termId}`),
  getGruposPorCarrera: (termId, idCarrera) =>
    request(`/terms/turns/grupos?termId=${termId}&carrera=${idCarrera}`),
  createGrupos: (termId, grupos) =>
    request(`/terms/turns/grupos?termId=${termId}`, { method: 'POST', body: grupos }),
  createAlumnos: (termId, alumnos) =>
    request(`/terms/turns/alumnos?termId=${termId}`, { method: 'POST', body: alumnos }),
  // filters: { secuencia: string[], carrera: number[], sinAsignar: boolean }
  queryAlumnos: (termId, filters = {}) => {
    const params = new URLSearchParams();
    params.set('termId', termId);
    for (const s of filters.secuencia ?? []) params.append('secuencia', s);
    for (const c of filters.carrera ?? []) params.append('carrera', c);
    if (filters.sinAsignar !== undefined) params.set('sinAsignar', String(filters.sinAsignar));
    return request(`/terms/turns/alumnos?${params.toString()}`);
  },
  updateDomicilio: (termId, pr, domicilio) =>
    request(`/terms/turns/alumnos/${encodeURIComponent(pr)}/domicilio?termId=${termId}`, {
      method: 'PATCH',
      body: domicilio,
    }),
  updateGrupoAlumno: (termId, pr, idGrupo) =>
    request(`/terms/turns/alumnos/${encodeURIComponent(pr)}/grupo?termId=${termId}`, {
      method: 'PATCH',
      body: { idGrupo },
    }),
  getConteo: (termId) => request(`/terms/turns/alumnos/conteo?termId=${termId}`),
  asignarGrupos: (termId) => request(`/terms/turns/grupos/asignar?termId=${termId}`),
};

export const api = USE_MOCKS ? mockApi : realApi;
