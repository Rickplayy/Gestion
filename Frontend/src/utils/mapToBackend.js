// Traduce lo que ya parsean excelParser.js/groupGenerator.js al formato que
// espera el backend. El matching de carrera es por palabra clave (no texto
// exacto) porque el catálogo en BD tiene variaciones de escritura frente al
// Excel (ej. "Trasporte" en la BD vs "Transporte" en el archivo).

const normalizeText = (value) =>
  String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

function careerKeyword(value) {
  const n = normalizeText(value);
  if (n.includes('ADMINISTRACION')) return 'ADMIN';
  if (n.includes('CIENCIAS') && n.includes('INFORMATICA')) return 'CIENCIAS_INFORMATICA';
  if (n.includes('FERROVIARIA')) return 'FERROVIARIA';
  if (n.includes('TRASPORTE') || n.includes('TRANSPORTE')) return 'TRANSPORTE';
  if (n.includes('INDUSTRIAL')) return 'INDUSTRIAL';
  if (n.includes('INFORMATICA')) return 'INFORMATICA';
  return null;
}

export function buildCarreraIndex(carreras) {
  const byKeyword = new Map();
  for (const carrera of carreras) {
    const key = careerKeyword(carrera.descripcion);
    if (key !== null) byKeyword.set(key, carrera.id);
  }
  return byKeyword;
}

export function resolveCarreraId(carreraIndex, nombreCarrera) {
  const key = careerKeyword(nombreCarrera);
  return key === null ? undefined : carreraIndex.get(key);
}

export function normalizeTurno(value) {
  const v = normalizeText(value);
  if (v.startsWith('M')) return 'M';
  if (v.startsWith('V')) return 'V';
  return null;
}

// secuenciasList: salida de extractSecuencias() -> [{secuencia, turno, carrera, cupo}]
export function buildGruposPayload(secuenciasList, carreras) {
  const carreraIndex = buildCarreraIndex(carreras);
  const validos = [];
  const omitidos = [];

  for (const s of secuenciasList) {
    const idCarrera = resolveCarreraId(carreraIndex, s.carrera);
    if (idCarrera === undefined) {
      omitidos.push({ secuencia: s.secuencia, motivo: `Carrera no reconocida: "${s.carrera}"` });
      continue;
    }
    const turno = normalizeTurno(s.turno);
    if (turno === null) {
      omitidos.push({ secuencia: s.secuencia, motivo: `Turno no reconocido: "${s.turno}"` });
      continue;
    }
    validos.push({ secuencia: s.secuencia, cupo: s.cupo, turno, carrera: idCarrera });
  }

  return { validos, omitidos };
}

// parsedRecords: salida de parseExcelBuffer() (excelParser.js)
export function buildAlumnosPayload(parsedRecords, carreras) {
  const carreraIndex = buildCarreraIndex(carreras);
  const validos = [];
  const omitidos = [];

  for (const r of parsedRecords) {
    const pr = String(r.PR || '').trim();
    if (!pr) {
      omitidos.push({ pr: null, motivo: 'Sin PR' });
      continue;
    }

    const idCarrera = resolveCarreraId(carreraIndex, r.PROGRAMA_EDUCATIVO);
    if (idCarrera === undefined) {
      omitidos.push({ pr, motivo: `Carrera no reconocida: "${r.PROGRAMA_EDUCATIVO}"` });
      continue;
    }

    const folio = Number.parseInt(r.FOLIO, 10);
    if (!Number.isInteger(folio)) {
      omitidos.push({ pr, motivo: `Folio inválido: "${r.FOLIO}"` });
      continue;
    }

    const generoRaw = normalizeText(r.GENERO);
    const sexo = generoRaw === 'F' || generoRaw === 'FEMENINO' ? 'F' : 'M';
    const promedio = Number.parseFloat(r.PROMEDIO);

    validos.push({
      BOLETA: r.BOLETA || null,
      PR: pr,
      CURP: r.CURP || '',
      NOMBRE: r.NOMBRE || '',
      DOMICILIO: {
        CALLE: r.calle || '',
        NUMERO: '',
        COLONIA: r.colonia || '',
        DELEGACION: r.delegacion || '',
        CP: r.cp || '',
        ESTADO: r.ENTIDAD_FEDERATIVA || '',
      },
      FECHA_NACIMIENTO: r.FECHA_NACIMIENTO || '',
      SEXO: sexo,
      PROGRAMA_EDUCATIVO: idCarrera,
      ESCUELA_PROCEDENCIA: r.ESCUELA_PROCEDENCIA || '',
      ENTIDAD_ESCUELA: r.ENTIDAD_ESCUELA_PROCEDENCIA || '',
      EMAIL: r.EMAIL || '',
      ESTATUS: 1,
      PROMEDIO: Number.isFinite(promedio) ? promedio : null,
      FOLIO: folio,
    });
  }

  return { validos, omitidos };
}
