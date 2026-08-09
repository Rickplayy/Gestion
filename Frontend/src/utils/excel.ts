import type * as XLSXType from 'xlsx';

// xlsx se carga bajo demanda (import dinámico) para no inflar el bundle
// inicial: la librería solo se descarga cuando el usuario procesa un Excel.
let xlsxPromise: Promise<typeof XLSXType> | null = null;
export function getXLSX(): Promise<typeof XLSXType> {
  xlsxPromise ??= import('xlsx');
  return xlsxPromise;
}

const NBSP_RE = new RegExp(' ', 'g');

// Normaliza cualquier valor de celda: colapsa espacios, quita nbsp y recorta.
export function limpiar(valor: unknown): string {
  return String(valor ?? '')
    .replace(NBSP_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type ReadSheetRowsOptions = {
  sheetNameIncludes?: string | null;
  defval?: string;
};

// Lee un buffer de Excel y regresa las filas de una hoja como matriz.
// Si se pasa sheetNameIncludes, busca la primera hoja cuyo nombre lo contenga;
// si no hay coincidencia (o no se pasa), usa la primera hoja.
export async function readSheetRows(
  buffer: ArrayBuffer,
  { sheetNameIncludes = null, defval = '' }: ReadSheetRowsOptions = {},
): Promise<string[][]> {
  const XLSX = await getXLSX();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  let sheetName = workbook.SheetNames[0];
  if (sheetNameIncludes) {
    const match = workbook.SheetNames.find((s) =>
      s.toUpperCase().includes(sheetNameIncludes.toUpperCase()),
    );
    if (match) sheetName = match;
  }
  if (sheetName === undefined) return [];
  const sheet = workbook.Sheets[sheetName];
  if (sheet === undefined) return [];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval, raw: false });
}

// Encuentra el índice de la fila de cabecera: la primera fila que contiene
// todas las columnas requeridas (comparación en mayúsculas).
export function findHeaderRow(rows: string[][], requiredCols: string[]): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const texto = row.map(limpiar).join(' ').toUpperCase();
    if (requiredCols.every((col) => texto.includes(col))) {
      return i;
    }
  }
  return -1;
}
