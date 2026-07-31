import { limpiar, readSheetRows, findHeaderRow, getXLSX } from "./excelUtils";
import { extraerDomicilio } from "./excelParser";

export const normalizeCareer = (name) => {
  const n = String(name || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes('ADMINISTRACION')) return 'ADMINISTRACIÓN INDUSTRIAL';
  if (n.includes('CIENCIAS DE LA INFORMATICA')) return 'CIENCIAS DE LA INFORMÁTICA';
  if (n.includes('FERROVIARIA')) return 'INGENIERÍA FERROVIARIA';
  if (n.includes('INDUSTRIAL') && !n.includes('ADMINISTRACION')) return 'INGENIERÍA INDUSTRIAL';
  if (n.includes('INFORMATICA') && !n.includes('CIENCIAS')) return 'INGENIERÍA EN INFORMÁTICA';
  if (n.includes('TRANSPORTE')) return 'INGENIERÍA EN TRANSPORTE';
  return String(name || '').trim();
};

const getTurnoFromSequence = (seq) => {
  if (seq && seq.length >= 3) {
    if (seq[2] === 'M') return 'Matutino';
    if (seq[2] === 'V') return 'Vespertino';
  }
  return 'Indefinido';
};

// Lee el archivo "Secuencias primer semestre XX-X.xlsx".
// Estructura esperada: TURNO | SECUENCIA | CARRERA (con prefijo "A-") | CUPO
// Regresa [{ secuencia, turno, carrera, cupo }] en el orden del archivo.
// Se exporta también para que la UI pueda listar las secuencias y ofrecer
// el editor de porcentajes por secuencia.
export async function extractSecuencias(buffer) {
  const rows = await readSheetRows(buffer);

  const headerRowIndex = findHeaderRow(rows, ["TURNO", "SECUENCIA", "CUPO"]);
  if (headerRowIndex === -1) {
    throw new Error("El archivo de Secuencias no tiene las columnas TURNO, SECUENCIA, CARRERA y CUPO");
  }

  const secuencias = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;

    const secuencia = limpiar(row[1]).toUpperCase();
    const cupo = parseInt(limpiar(row[3]), 10);
    if (!secuencia || isNaN(cupo) || cupo <= 0) continue;

    // La carrera viene con prefijo de letra ("A-ADMINISTRACION INDUSTRIAL")
    const carreraRaw = limpiar(row[2]).replace(/^[A-Z]\s*-\s*/i, '');

    secuencias.push({
      secuencia,
      turno: limpiar(row[0]) || getTurnoFromSequence(secuencia),
      carrera: normalizeCareer(carreraRaw),
      cupo,
    });
  }

  if (secuencias.length === 0) {
    throw new Error("No se encontraron secuencias válidas en el archivo");
  }
  return secuencias;
}

// ---------------------------------------------------------------------------
// Distancia domicilio → escuela.
//
// Portado del backend (Backend/src/modules/turns/turns.repository.ts): el
// domicilio se ubica en coordenadas y de ahí se saca la distancia real por
// calles. Con esa distancia se define la preferencia de turno: entre más lejos
// viva el alumno, mayor prioridad para turno Matutino (AM).
// ---------------------------------------------------------------------------

// Fuera del catálogo con formato "... COL X DELEG Y C.P. 12345" el regex del
// parser no saca nada. Antes de rendirse se busca cualquier CP de 5 dígitos en
// el texto: alcanza para ubicar por código postal (nivel 3) en vez de perder al
// alumno por completo.
const domicilioParaGeo = (texto) => {
  const partes = extraerDomicilio(texto);
  if (partes.colonia || partes.delegacion || partes.cp) return partes;

  const cpSuelto = String(texto || '').match(/\b(\d{5})\b/);
  return { ...partes, cp: cpSuelto ? cpSuelto[1] : null };
};

// Mismo patrón que mapWithConcurrency() del backend: varios en paralelo, pero
// con tope. Los domicilios ya vistos salen del cache al instante; los nuevos se
// forman igual en la cola del geocodificador.
const WORK_CONCURRENCY = 10;

const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
};

// Llena `kms` (kilómetros, null si no se pudo ubicar) en cada aspirante.
// Sin servicio de distancia devuelve la lista intacta con kms en null, que es
// justo el comportamiento previo: el reparto entonces se decide solo por
// promedio, como antes de existir esta función.
async function enrichWithKms(aspirantes, distanceService, onProgress) {
  if (!distanceService) {
    return aspirantes.map(a => ({ ...a, kms: null, distanceSource: null, nivel: null }));
  }

  let listos = 0;
  return mapWithConcurrency(aspirantes, WORK_CONCURRENCY, async (a) => {
    let medicion;
    try {
      medicion = await distanceService.measure(domicilioParaGeo(a.domicilio));
    } catch {
      // Un domicilio que no se puede ubicar no debe tumbar la generación
      // completa: ese alumno se queda sin distancia y se reparte al final.
      medicion = null;
    }

    listos += 1;
    onProgress?.(listos, aspirantes.length);

    return {
      ...a,
      kms: medicion ? Math.round((medicion.meters / 1000) * 100) / 100 : null,
      distanceSource: medicion?.source ?? null,
      nivel: medicion?.nivel ?? null,
    };
  });
}

// Más lejos primero; sin distancia al final; empates por promedio.
// Equivale a compareAlumnoPriority() del backend (el sexo aquí no entra porque
// ya se maneja con las cuotas por secuencia).
const compararPorLejania = (a, b) => {
  if (a.kms === null && b.kms === null) return b.promedio - a.promedio;
  if (a.kms === null) return 1;
  if (b.kms === null) return -1;
  if (b.kms !== a.kms) return b.kms - a.kms;
  return b.promedio - a.promedio;
};

/**
 * Genera la asignación de grupos.
 *
 * @param aspirantesBuffer  Excel de aspirantes (Nuevo-ingreso-261.xlsx)
 * @param secuencias         Lista ya extraída con extractSecuencias() (evita re-leer y
 *                           re-parsear el mismo Excel de secuencias, que la UI ya carga
 *                           al seleccionar el archivo)
 * @param options
 *   - defaultWomenPct: % de mujeres por secuencia (default 50; hombres = 100 - mujeres)
 *   - womenPctBySeq:   overrides por secuencia, ej. { "1AM10": 60 }
 *   - cicloEscolar:    ciclo al que pertenece la generación, ej. "26-1". Acota
 *                      el resultado igual que el ID_CICLO_ESCOLAR del backend.
 *   - distanceService: servicio de utils/geo/distance.js. Si viene, se calcula
 *                      la distancia de cada alumno y los más lejanos ganan turno
 *                      matutino. Si no viene, el reparto va solo por promedio.
 *   - onDistanceProgress: (listos, total) para que la UI muestre el avance.
 */
export async function generateGroupsFromBuffer(aspirantesBuffer, secuencias, options = {}) {
  const {
    defaultWomenPct = 50,
    womenPctBySeq = {},
    cicloEscolar = '',
    distanceService = null,
    onDistanceProgress = null,
  } = options;

  const rows = await readSheetRows(aspirantesBuffer, { sheetNameIncludes: 'ASPIRANTES' });
  const headerRowIndex = findHeaderRow(rows, ["BOLETA", "NOMBRE"]);
  if (headerRowIndex === -1) throw new Error("No se encontró la cabecera en el Excel de aspirantes");

  const recordsByCareer = {};

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;

    const boleta = limpiar(row[0]);
    if (!boleta) continue;

    const nombre = limpiar(row[3]);
    const generoRaw = limpiar(row[7]).toUpperCase();
    const trueGenero = generoRaw === 'F' ? 'Mujer' : 'Hombre';

    const carrera = normalizeCareer(limpiar(row[9]));
    const promedio = parseFloat(limpiar(row[15])) || 0;
    const domicilio = limpiar(row[4]); // lo usará la API de kms

    if (!recordsByCareer[carrera]) recordsByCareer[carrera] = [];
    recordsByCareer[carrera].push({ boleta, nombre, carrera, genero: trueGenero, promedio, domicilio });
  }

  // Agrupar secuencias por carrera (matutino primero, como preferencia)
  const seqsByCareer = {};
  for (const s of secuencias) {
    if (!seqsByCareer[s.carrera]) seqsByCareer[s.carrera] = [];
    seqsByCareer[s.carrera].push(s);
  }
  for (const carrera in seqsByCareer) {
    seqsByCareer[carrera].sort((a, b) => {
      const isAM = a.secuencia[2] === 'M' ? 0 : 1;
      const isBM = b.secuencia[2] === 'M' ? 0 : 1;
      if (isAM !== isBM) return isAM - isBM;
      return a.secuencia.localeCompare(b.secuencia);
    });
  }

  const finalAssignments = [];

  const asignar = (student, seq) => {
    finalAssignments.push({
      CicloEscolar: cicloEscolar,
      Boleta: student.boleta,
      Nombre: student.nombre,
      Carrera: student.carrera,
      Turno: getTurnoFromSequence(seq),
      Genero: student.genero,
      Promedio: student.promedio,
      // Vacío (no 0) cuando no se pudo ubicar el domicilio: un 0 se leería como
      // "vive en la escuela" y lo mandaría hasta el principio de la fila.
      Kms: student.kms ?? '',
      Secuencia: seq,
    });
  };

  // Admisión: por promedio, dentro de cada carrera y hasta el cupo total. La
  // distancia NO decide quién entra (eso sería injusto), solo en qué turno queda.
  const admitidosPorCarrera = {};
  for (const carrera in recordsByCareer) {
    const seqs = seqsByCareer[carrera];
    if (!seqs || seqs.length === 0) continue; // carrera sin secuencias en el archivo

    const ordenados = [...recordsByCareer[carrera]].sort((a, b) => b.promedio - a.promedio);
    const cupoTotal = seqs.reduce((sum, s) => sum + s.cupo, 0);
    admitidosPorCarrera[carrera] = ordenados.slice(0, cupoTotal);
  }

  // La distancia se calcula de una sola pasada para TODOS los admitidos, no por
  // carrera: así el cache del geocodificador se aprovecha entre carreras y el
  // avance que ve el usuario es sobre el total real, no reiniciándose en cada una.
  const planos = Object.values(admitidosPorCarrera).flat();
  const enriquecidos = await enrichWithKms(planos, distanceService, onDistanceProgress);

  let corte = 0;
  for (const carrera in admitidosPorCarrera) {
    const n = admitidosPorCarrera[carrera].length;
    admitidosPorCarrera[carrera] = enriquecidos.slice(corte, corte + n);
    corte += n;
  }

  for (const carrera in admitidosPorCarrera) {
    const seqs = seqsByCareer[carrera];
    const admitidos = admitidosPorCarrera[carrera];
    const cupoTotal = seqs.reduce((sum, s) => sum + s.cupo, 0);

    // Dentro de cada sexo, los que viven más lejos van primero. Como las
    // secuencias ya están ordenadas con las matutinas al frente, eso les da la
    // preferencia AM. Sin distancias (todas null) el orden vuelve a ser por
    // promedio, que es como se comportaba antes de existir esta función.
    const mujeres = admitidos.filter(s => s.genero === 'Mujer').sort(compararPorLejania);
    const hombres = admitidos.filter(s => s.genero === 'Hombre').sort(compararPorLejania);
    const totalAdmitidos = admitidos.length;

    // Se consumen ambas listas con punteros en vez de shift(): shift() es O(n)
    // por llamada (reindexa el arreglo completo), lo que vuelve el reparto
    // O(n²) con cohortes grandes. Avanzar un índice es O(1) y preserva el
    // orden de asignación que acaban de fijar los sort() de arriba.
    let mIdx = 0;
    let hIdx = 0;
    const mujeresLeft = () => mujeres.length - mIdx;
    const hombresLeft = () => hombres.length - hIdx;

    // Repartir proporcionalmente al cupo de cada secuencia
    for (let i = 0; i < seqs.length; i++) {
      const { secuencia, cupo } = seqs[i];
      const esUltima = i === seqs.length - 1;

      // La última secuencia absorbe lo que quede (evita perder gente por redondeos)
      let target = esUltima
        ? mujeresLeft() + hombresLeft()
        : Math.min(cupo, Math.round(totalAdmitidos * (cupo / cupoTotal)));
      if (esUltima) target = Math.min(target, cupo + seqs.length); // margen pequeño por redondeo

      const pct = womenPctBySeq[secuencia] ?? defaultWomenPct;
      const womenQuota = Math.round(target * (pct / 100));
      let assigned = 0;

      // Mujeres hasta su cuota
      while (assigned < womenQuota && mIdx < mujeres.length) {
        asignar(mujeres[mIdx++], secuencia);
        assigned++;
      }
      // Hombres para completar
      while (assigned < target && hIdx < hombres.length) {
        asignar(hombres[hIdx++], secuencia);
        assigned++;
      }
      // Si faltan hombres, completar con mujeres
      while (assigned < target && mIdx < mujeres.length) {
        asignar(mujeres[mIdx++], secuencia);
        assigned++;
      }
    }

    // Sobrantes por redondeo → última secuencia
    const lastSeq = seqs[seqs.length - 1].secuencia;
    while (mIdx < mujeres.length) asignar(mujeres[mIdx++], lastSeq);
    while (hIdx < hombres.length) asignar(hombres[hIdx++], lastSeq);
  }

  if (finalAssignments.length === 0) {
    throw new Error("No se encontraron registros válidos para procesar. Revisa que los archivos tengan el formato esperado.");
  }

  return finalAssignments;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Abre el diálogo "Guardar como" y deja listo el stream de escritura.
//
// Los DOS pasos (showSaveFilePicker y createWritable) necesitan la activación
// del usuario, así que ambos ocurren aquí, dentro del click y antes de procesar
// nada. Dejar createWritable() para después del procesamiento es justo lo que
// dejaba el archivo en 0 bytes: al elegir el nombre el diálogo ya crea el
// archivo vacío, y para cuando terminaba el reparto el gesto había expirado y
// createWritable() fallaba con NotAllowedError, así que nunca se escribía nada.
// El stream, en cambio, sigue siendo válido por más que tarde el procesamiento.
//
// Regresa: { handle, writable } | { cancelled: true } | null (sin soporte).
export async function pickSaveTarget(defaultFilename = 'gruposAsignados.xlsx') {
  if (!window.showSaveFilePicker) return null;

  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: defaultFilename,
      types: [{
        description: 'Excel Workbook',
        accept: { [XLSX_MIME]: ['.xlsx'] },
      }],
    });
  } catch (err) {
    if (err.name === 'AbortError') return { cancelled: true };
    return null; // sin permiso: se usará la descarga clásica
  }

  try {
    return { handle, writable: await handle.createWritable() };
  } catch {
    await discardSaveTarget({ handle });
    return null;
  }
}

// Descarta el destino elegido sin dejar rastro. Se usa cuando algo falla
// después de abrir el diálogo: es preferible no dejar nada a dejar un .xlsx de
// 0 bytes, que parece descargado pero Excel rechaza como dañado.
export async function discardSaveTarget(target) {
  if (!target || target.cancelled) return;
  try { await target.writable?.abort(); } catch { /* ya estaba cerrado */ }
  try { await target.handle?.remove(); } catch { /* navegador sin remove() */ }
}

// Escribe el Excel. Si hay target (elegido con pickSaveTarget) escribe ahí;
// si no, descarga clásica del navegador con el nombre sugerido.
// Regresa { name, location: 'elegido' | 'descargas' }.
export async function exportToExcel(data, defaultFilename = 'gruposAsignados.xlsx', target = null) {
  const XLSX = await getXLSX();
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Grupos Asignados");

  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  if (target?.writable) {
    const saved = await writeToTarget(target, bytes);
    if (saved) return { name: saved, location: 'elegido' };
    // Si la escritura no cuajó se descarta el archivo a medias y se cae a la
    // descarga normal: el usuario se queda con su Excel de todos modos.
  }

  downloadBytes(bytes, defaultFilename);
  return { name: defaultFilename, location: 'descargas' };
}

// Escribe en el destino elegido y confirma que el archivo quedó con contenido.
// Regresa el nombre guardado, o null si no se pudo (el llamador descarga).
async function writeToTarget(target, bytes) {
  try {
    await target.writable.write(bytes);
    await target.writable.close();
  } catch {
    await discardSaveTarget(target);
    return null;
  }

  // Verificación explícita: close() puede resolver y aun así dejar el archivo
  // vacío (antivirus o sincronización bloqueando el rename del .crswap). Es
  // exactamente el caso que Excel reporta como "dañado o extensión no válida",
  // así que se confirma el tamaño antes de dar el guardado por bueno.
  try {
    const { size } = await target.handle.getFile();
    if (size === bytes.byteLength) return target.handle.name;
  } catch { /* no se pudo releer: se trata como fallo */ }

  await discardSaveTarget({ handle: target.handle });
  return null;
}

// Descarga normal (el navegador decide la carpeta de descargas).
// OJO: no revocar la URL justo después de click(). La descarga real del blob
// la dispara el navegador de forma asíncrona; revocar de inmediato corta la
// lectura a la mitad y el .xlsx queda truncado (más notorio cuantos más
// alumnos trae). Se espera un momento antes de liberar la URL.
function downloadBytes(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
