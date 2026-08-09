import { limpiar, readSheetRows, findHeaderRow, getXLSX } from './excel';

export type Secuencia = {
  secuencia: string;
  turno: string;
  carrera: string;
  cupo: number;
};

export const normalizeCareer = (name: unknown): string => {
  const DIACRITICS_RE = new RegExp(
    `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
    'g',
  );
  const n = String(name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '');
  if (n.includes('ADMINISTRACION')) return 'ADMINISTRACIÓN INDUSTRIAL';
  if (n.includes('CIENCIAS DE LA INFORMATICA')) return 'CIENCIAS DE LA INFORMÁTICA';
  if (n.includes('FERROVIARIA')) return 'INGENIERÍA FERROVIARIA';
  if (n.includes('INDUSTRIAL') && !n.includes('ADMINISTRACION')) return 'INGENIERÍA INDUSTRIAL';
  if (n.includes('INFORMATICA') && !n.includes('CIENCIAS')) return 'INGENIERÍA EN INFORMÁTICA';
  if (n.includes('TRANSPORTE')) return 'INGENIERÍA EN TRANSPORTE';
  return String(name || '').trim();
};

const getTurnoFromSequence = (seq: string): string => {
  if (seq && seq.length >= 3) {
    if (seq[2] === 'M') return 'Matutino';
    if (seq[2] === 'V') return 'Vespertino';
  }
  return 'Indefinido';
};

// Lee el archivo "Secuencias primer semestre XX-X.xlsx".
// Estructura esperada: TURNO | SECUENCIA | CARRERA (con prefijo "A-") | CUPO
// Regresa [{ secuencia, turno, carrera, cupo }] en el orden del archivo.
export async function extractSecuencias(buffer: ArrayBuffer): Promise<Secuencia[]> {
  const rows = await readSheetRows(buffer);

  const headerRowIndex = findHeaderRow(rows, ['TURNO', 'SECUENCIA', 'CUPO']);
  if (headerRowIndex === -1) {
    throw new Error(
      'El archivo de Secuencias no tiene las columnas TURNO, SECUENCIA, CARRERA y CUPO',
    );
  }

  const secuencias: Secuencia[] = [];
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
    throw new Error('No se encontraron secuencias válidas en el archivo');
  }
  return secuencias;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type SaveTarget =
  | { handle: FileSystemFileHandle; writable: FileSystemWritableFileStream; cancelled?: undefined }
  | { cancelled: true; handle?: undefined; writable?: undefined };

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
export async function pickSaveTarget(
  defaultFilename = 'gruposAsignados.xlsx',
): Promise<SaveTarget | null> {
  if (!window.showSaveFilePicker) return null;

  let handle: FileSystemFileHandle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: defaultFilename,
      types: [
        {
          description: 'Excel Workbook',
          accept: { [XLSX_MIME]: ['.xlsx'] },
        },
      ],
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return { cancelled: true };
    return null; // sin permiso: se usará la descarga clásica
  }

  try {
    return { handle, writable: await handle.createWritable() };
  } catch {
    await discardSaveTarget({ handle } as SaveTarget);
    return null;
  }
}

// Descarta el destino elegido sin dejar rastro. Se usa cuando algo falla
// después de abrir el diálogo: es preferible no dejar nada a dejar un .xlsx de
// 0 bytes, que parece descargado pero Excel rechaza como dañado.
export async function discardSaveTarget(target: SaveTarget | null | undefined): Promise<void> {
  if (!target || target.cancelled) return;
  try {
    await target.writable?.abort();
  } catch {
    /* ya estaba cerrado */
  }
  try {
    await target.handle?.remove?.();
  } catch {
    /* navegador sin remove() */
  }
}

export type ExportResult = { name: string; location: 'elegido' | 'descargas' };

// Escribe el Excel. Si hay target (elegido con pickSaveTarget) escribe ahí;
// si no, descarga clásica del navegador con el nombre sugerido.
export async function exportToExcel(
  data: Record<string, unknown>[],
  defaultFilename = 'gruposAsignados.xlsx',
  target: SaveTarget | null = null,
): Promise<ExportResult> {
  const XLSX = await getXLSX();
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Grupos Asignados');

  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;

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
async function writeToTarget(target: SaveTarget, bytes: ArrayBuffer): Promise<string | null> {
  if (!target.writable || !target.handle) return null;
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
    const file = await target.handle.getFile();
    if (file.size === bytes.byteLength) return target.handle.name;
  } catch {
    /* no se pudo releer: se trata como fallo */
  }

  await discardSaveTarget({ handle: target.handle } as SaveTarget);
  return null;
}

// Descarga normal (el navegador decide la carpeta de descargas).
// OJO: no revocar la URL justo después de click(). La descarga real del blob
// la dispara el navegador de forma asíncrona; revocar de inmediato corta la
// lectura a la mitad y el .xlsx queda truncado (más notorio cuantos más
// alumnos trae). Se espera un momento antes de liberar la URL.
function downloadBytes(bytes: ArrayBuffer, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
