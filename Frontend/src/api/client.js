const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const TOKEN_KEY = 'sige_token';

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

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  getCarreras: () => request('/turns/carreras', { auth: false }),
  createTerm: (descripcion) => request('/terms', { method: 'POST', body: { descripcion } }),
  createGrupos: (termId, grupos) =>
    request(`/terms/turns/grupos?termId=${termId}`, { method: 'POST', body: grupos }),
  getGrupos: (termId) => request(`/terms/turns/grupos?termId=${termId}`),
  createAlumnos: (termId, alumnos) =>
    request(`/terms/turns/alumnos?termId=${termId}`, { method: 'POST', body: alumnos }),
  getConteo: (termId) => request(`/terms/turns/alumnos/conteo?termId=${termId}`),
  asignarGrupos: (termId) => request(`/terms/turns/grupos/asignar?termId=${termId}`),
};
