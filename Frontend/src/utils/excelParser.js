import { limpiar, readSheetRows, findHeaderRow } from "./excelUtils";

function extraerDomicilio(domicilio) {
  const d = limpiar(domicilio);

  const regex =
    /^(.*?)\s+COL(?:ONIA)?\.?\s+(.*?)\s+DELEG\.?\s+(.*?)\s+C\.?P\.?\s*(\d{5})/i;

  const match = d.match(regex);

  if (!match) {
    return {
      calle: null,
      colonia: null,
      delegacion: null,
      cp: null,
    };
  }

  return {
    calle: limpiar(match[1]),
    colonia: limpiar(match[2]),
    delegacion: limpiar(match[3]),
    cp: limpiar(match[4]),
  };
}

function esFilaDatos(row) {
  const curp = limpiar(row[2]);
  return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i.test(curp);
}

function aTexto(valor) {
  const v = limpiar(valor);
  return v === "" ? null : v;
}

export async function parseExcelBuffer(buffer) {
  const rows = await readSheetRows(buffer);

  const headerRowIndex = findHeaderRow(rows, [
    "BOLETA", "CURP", "NOMBRE", "DOMICILIO", "EMAIL", "FOLIO",
  ]);

  if (headerRowIndex === -1) {
    throw new Error("No se encontró la fila de encabezados reales");
  }

  const resultados = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];

    if (!row || row.length === 0) continue;
    if (!esFilaDatos(row)) continue;

    const domicilio = limpiar(row[4]);
    const domicilioParseado = extraerDomicilio(domicilio);

    const registro = {
      BOLETA: aTexto(row[0]),
      PR: aTexto(row[1]),
      CURP: aTexto(row[2]),
      NOMBRE: aTexto(row[3]),
      DOMICILIO: aTexto(row[4]),
      ENTIDAD_FEDERATIVA: aTexto(row[5]),
      FECHA_NACIMIENTO: aTexto(row[6]),
      GENERO: aTexto(row[7]),
      UNIDAD_ACADEMICA: aTexto(row[8]),
      PROGRAMA_EDUCATIVO: aTexto(row[9]),
      ESCUELA_PROCEDENCIA: aTexto(row[10]),
      ENTIDAD_ESCUELA_PROCEDENCIA: aTexto(row[11]),
      EMAIL: aTexto(row[12]),
      SEMESTRE: aTexto(row[13]),
      ESTADO: aTexto(row[14]),
      PROMEDIO: aTexto(row[15]),
      FOLIO: aTexto(row[16]),
      calle: domicilioParseado.calle,
      colonia: domicilioParseado.colonia,
      delegacion: domicilioParseado.delegacion,
      cp: domicilioParseado.cp,
    };

    resultados.push(registro);
  }

  return resultados;
}
