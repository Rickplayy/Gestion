// xlsx se carga bajo demanda (import dinámico) para no inflar el bundle
// inicial: la librería solo se descarga cuando el usuario procesa un Excel.
let xlsxPromise = null;
export function getXLSX() {
  if (!xlsxPromise) xlsxPromise = import("xlsx");
  return xlsxPromise;
}

// Normaliza cualquier valor de celda: colapsa espacios, quita nbsp y recorta.
export function limpiar(valor) {
  return String(valor ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Lee un buffer de Excel y regresa las filas de una hoja como matriz.
// Si se pasa sheetNameIncludes, busca la primera hoja cuyo nombre lo contenga;
// si no hay coincidencia (o no se pasa), usa la primera hoja.
export async function readSheetRows(buffer, { sheetNameIncludes = null, defval = "" } = {}) {
  const XLSX = await getXLSX();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  let sheetName = workbook.SheetNames[0];
  if (sheetNameIncludes) {
    const match = workbook.SheetNames.find(s =>
      s.toUpperCase().includes(sheetNameIncludes.toUpperCase())
    );
    if (match) sheetName = match;
  }
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval, raw: false });
}

// Encuentra el índice de la fila de cabecera: la primera fila que contiene
// todas las columnas requeridas (comparación en mayúsculas).
export function findHeaderRow(rows, requiredCols) {
  for (let i = 0; i < rows.length; i++) {
    const texto = rows[i].map(limpiar).join(" ").toUpperCase();
    if (requiredCols.every(col => texto.includes(col))) {
      return i;
    }
  }
  return -1;
}
