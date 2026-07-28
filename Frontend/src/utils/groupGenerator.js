import { limpiar, readSheetRows, findHeaderRow, getXLSX } from "./excelUtils";

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
