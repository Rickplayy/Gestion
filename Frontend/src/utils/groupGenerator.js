import { limpiar, readSheetRows, findHeaderRow, getXLSX } from "./excelUtils";

const normalizeCareer = (name) => {
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
// PENDIENTE (API de kilómetros):
// Aquí se conectará la API que calcula la distancia (Kms) del domicilio de
// cada aspirante a la escuela. Con esa distancia se definirá la preferencia
// de turno: entre más lejos viva, mayor prioridad para turno Matutino (AM).
//
// Cuando la API exista:
//   1. Implementar la llamada dentro de enrichWithKms (recibe la lista de
//      aspirantes con su campo `domicilio` y debe llenar `kms`).
//   2. En generateGroupsFromBuffer, al repartir entre secuencias AM/PM,
//      ordenar por `kms` descendente para dar preferencia AM a los lejanos.
// ---------------------------------------------------------------------------
async function enrichWithKms(aspirantes) {
  // Por ahora la distancia queda en 0 para todos.
  return aspirantes.map(a => ({ ...a, kms: 0 }));
}

/**
 * Genera la asignación de grupos.
 *
 * @param aspirantesBuffer  Excel de aspirantes (Nuevo-ingreso-261.xlsx)
 * @param secuenciasBuffer  Excel de secuencias con cupos (Secuencias primer semestre 26-2.xlsx)
 * @param options
 *   - defaultWomenPct: % de mujeres por secuencia (default 50; hombres = 100 - mujeres)
 *   - womenPctBySeq:   overrides por secuencia, ej. { "1AM10": 60 }
 */
export async function generateGroupsFromBuffer(aspirantesBuffer, secuenciasBuffer, options = {}) {
  const { defaultWomenPct = 50, womenPctBySeq = {} } = options;

  const secuencias = await extractSecuencias(secuenciasBuffer);

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
      Boleta: student.boleta,
      Nombre: student.nombre,
      Carrera: student.carrera,
      Turno: getTurnoFromSequence(seq),
      Genero: student.genero,
      Promedio: student.promedio,
      Kms: student.kms ?? 0,
      Secuencia: seq,
    });
  };

  for (const carrera in recordsByCareer) {
    const seqs = seqsByCareer[carrera];
    if (!seqs || seqs.length === 0) continue; // carrera sin secuencias en el archivo

    // Ordenar de mayor a menor promedio y admitir hasta el cupo total
    const ordenados = recordsByCareer[carrera].sort((a, b) => b.promedio - a.promedio);
    const cupoTotal = seqs.reduce((sum, s) => sum + s.cupo, 0);
    let admitidos = ordenados.slice(0, cupoTotal);

    // Hueco para la API de kms (hoy no cambia nada; ver nota arriba)
    admitidos = await enrichWithKms(admitidos);

    const mujeres = admitidos.filter(s => s.genero === 'Mujer');
    const hombres = admitidos.filter(s => s.genero === 'Hombre');
    const totalAdmitidos = admitidos.length;

    // Repartir proporcionalmente al cupo de cada secuencia
    for (let i = 0; i < seqs.length; i++) {
      const { secuencia, cupo } = seqs[i];
      const esUltima = i === seqs.length - 1;

      // La última secuencia absorbe lo que quede (evita perder gente por redondeos)
      let target = esUltima
        ? mujeres.length + hombres.length
        : Math.min(cupo, Math.round(totalAdmitidos * (cupo / cupoTotal)));
      if (esUltima) target = Math.min(target, cupo + seqs.length); // margen pequeño por redondeo

      const pct = womenPctBySeq[secuencia] ?? defaultWomenPct;
      const womenQuota = Math.round(target * (pct / 100));
      let assigned = 0;

      // Mujeres hasta su cuota
      while (assigned < womenQuota && mujeres.length > 0) {
        asignar(mujeres.shift(), secuencia);
        assigned++;
      }
      // Hombres para completar
      while (assigned < target && hombres.length > 0) {
        asignar(hombres.shift(), secuencia);
        assigned++;
      }
      // Si faltan hombres, completar con mujeres
      while (assigned < target && mujeres.length > 0) {
        asignar(mujeres.shift(), secuencia);
        assigned++;
      }
    }

    // Sobrantes por redondeo → última secuencia
    const lastSeq = seqs[seqs.length - 1].secuencia;
    while (mujeres.length > 0) asignar(mujeres.shift(), lastSeq);
    while (hombres.length > 0) asignar(hombres.shift(), lastSeq);
  }

  if (finalAssignments.length === 0) {
    throw new Error("No se encontraron registros válidos para procesar. Revisa que los archivos tengan el formato esperado.");
  }

  return finalAssignments;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Abre el diálogo "Guardar como" para que el usuario elija nombre y ubicación.
// DEBE llamarse directamente en el click (antes de procesar los archivos):
// si se llama después de un procesamiento largo, el navegador invalida el
// gesto del usuario y la escritura falla dejando un .xlsx vacío/dañado.
// Regresa: fileHandle | { cancelled: true } | null (navegador sin soporte).
export async function pickSaveFile(defaultFilename = 'gruposAsignados.xlsx') {
  if (!window.showSaveFilePicker) return null;
  try {
    return await window.showSaveFilePicker({
      suggestedName: defaultFilename,
      types: [{
        description: 'Excel Workbook',
        accept: { [XLSX_MIME]: ['.xlsx'] },
      }],
    });
  } catch (err) {
    if (err.name === 'AbortError') return { cancelled: true };
    throw err;
  }
}

// Escribe el Excel. Si hay fileHandle (elegido con pickSaveFile) escribe ahí;
// si no, descarga clásica del navegador con el nombre sugerido.
export async function exportToExcel(data, defaultFilename = 'gruposAsignados.xlsx', fileHandle = null) {
  const XLSX = await getXLSX();
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Grupos Asignados");

  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([bytes], { type: XLSX_MIME });

  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return fileHandle.name;
  }

  // Fallback: descarga normal (el navegador decide la carpeta de descargas)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return defaultFilename;
}
