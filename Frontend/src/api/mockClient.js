import { MOCK_CARRERAS, MOCK_TERMS, MOCK_GRUPOS, MOCK_ALUMNOS } from './mockData';

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

let nextTermId = 1000;
const extraTerms = [];

const findGrupoBySecuencia = (termId, secuencia) => {
  const porCarrera = MOCK_GRUPOS[termId] ?? {};
  for (const [idCarrera, grupos] of Object.entries(porCarrera)) {
    const grupo = grupos.find((g) => g.secuencia === secuencia);
    if (grupo) return { grupo, idCarrera: Number(idCarrera) };
  }
  return null;
};

export const mockApi = {
  login: async (username, password) => {
    await delay();
    if (!username || !password) throw new Error('Usuario y contraseña son obligatorios.');
    return { token: 'mock-token' };
  },

  getCarreras: async () => {
    await delay();
    return { items: MOCK_CARRERAS };
  },

  listTerms: async () => {
    await delay();
    const withCarreras = (term) => {
      const porCarrera = MOCK_GRUPOS[term.id] ?? {};
      const carreras = Object.keys(porCarrera).map((idCarrera) => {
        const carrera = MOCK_CARRERAS.find((c) => c.id === Number(idCarrera));
        return { id: Number(idCarrera), descripcion: carrera?.descripcion ?? '' };
      });
      return { ...term, carreras };
    };
    return { items: [...extraTerms, ...MOCK_TERMS].map(withCarreras) };
  },

  createTerm: async (descripcion) => {
    await delay();
    const term = { id: nextTermId++, descripcion };
    extraTerms.unshift(term);
    return term;
  },

  getCarrerasPorCiclo: async (termId) => {
    await delay();
    const porCarrera = MOCK_GRUPOS[termId] ?? {};
    const items = Object.entries(porCarrera).map(([idCarrera, grupos]) => {
      const carrera = MOCK_CARRERAS.find((c) => c.id === Number(idCarrera));
      return { id: Number(idCarrera), descripcion: carrera?.descripcion ?? '', totalGrupos: grupos.length };
    });
    return { items };
  },

  getGruposPorCarrera: async (termId, idCarrera) => {
    await delay();
    const grupos = MOCK_GRUPOS[termId]?.[idCarrera] ?? [];
    const items = grupos.map((g) => ({
      ...g,
      totalAlumnos: MOCK_ALUMNOS[termId]?.[g.id]?.length ?? 0,
    }));
    return { items };
  },

  createGrupos: async (_termId, grupos) => {
    await delay();
    return { items: grupos.map((g, i) => ({ id: 9000 + i, ...g, idCarrera: g.carrera })) };
  },

  createAlumnos: async (_termId, alumnos) => {
    await delay();
    return { total: alumnos.length, insertados: alumnos.length, duplicados: [], fallidos: [] };
  },

  queryAlumnos: async (termId, filters = {}) => {
    await delay();
    const secuencia = filters.secuencia?.[0];
    if (secuencia) {
      const found = findGrupoBySecuencia(termId, secuencia);
      const items = found ? MOCK_ALUMNOS[termId]?.[found.grupo.id] ?? [] : [];
      return { items, total: items.length };
    }
    let all = Object.values(MOCK_ALUMNOS[termId] ?? {}).flat();
    if (filters.carrera?.length) {
      all = all.filter((a) => filters.carrera.includes(a.idCarrera));
    }
    return { items: all, total: all.length };
  },

  updateDomicilio: async () => {
    await delay();
    throw new Error('No disponible en modo mock.');
  },

  updateGrupoAlumno: async () => {
    await delay();
    throw new Error('No disponible en modo mock.');
  },

  getConteo: async (termId) => {
    await delay();
    const porCarrera = MOCK_GRUPOS[termId] ?? {};
    const carreras = Object.entries(porCarrera).map(([idCarrera, grupos]) => {
      const carrera = MOCK_CARRERAS.find((c) => c.id === Number(idCarrera));
      const alumnos = grupos.flatMap((g) => MOCK_ALUMNOS[termId]?.[g.id] ?? []);
      const mujeres = alumnos.filter((a) => a.genero === 'F').length;
      const hombres = alumnos.length - mujeres;
      return { idCarrera: Number(idCarrera), descripcion: carrera?.descripcion ?? '', total: alumnos.length, hombres, mujeres };
    });
    const total = carreras.reduce((sum, c) => sum + c.total, 0);
    const hombres = carreras.reduce((sum, c) => sum + c.hombres, 0);
    const mujeres = carreras.reduce((sum, c) => sum + c.mujeres, 0);
    return { carreras, total, hombres, mujeres };
  },

  asignarGrupos: async (termId) => {
    await delay();
    const total = Object.values(MOCK_ALUMNOS[termId] ?? {}).flat().length;
    return { totalAlumnos: total, asignados: total, sinGrupo: 0 };
  },
};
