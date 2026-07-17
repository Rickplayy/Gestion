import { limpiar, readSheetRows, findHeaderRow, getXLSX } from "./excelUtils";

const sequenceMap = {
  "ADMINISTRACIÓN INDUSTRIAL": ["1AM10", "1AM11", "1AM12", "1AV10", "1AV11", "1AV12", "1AV13"],
  "CIENCIAS DE LA INFORMÁTICA": ["1CM10", "1CM11", "1CM12", "1CV10", "1CV11", "1CV12"],
  "INGENIERÍA FERROVIARIA": ["1FM10", "1FV10"],
  "INGENIERÍA INDUSTRIAL": ["1IM10", "1IM11", "1IM12", "1IM13", "1IV10", "1IV11", "1IV12"],
  "INGENIERÍA EN INFORMÁTICA": ["1NM10", "1NM11", "1NM12", "1NV10", "1NV11"],
  "INGENIERÍA EN TRANSPORTE": ["1TM10", "1TM11", "1TV10", "1TV11"],
};

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

async function extractLugares(buffer) {
  if (!buffer) return {};
  const rows = await readSheetRows(buffer);

  const map = {};
  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const key = String(row[0]).trim();
    const val = parseInt(row[1], 10);
    if (!isNaN(val) && key !== 'Etiquetas de fila' && !key.toLowerCase().includes('total')) {
      map[normalizeCareer(key)] = val;
    }
  }
  return map;
}

export async function generateGroupsFromBuffer(aspirantesBuffer, lugaresBuffer) {
  const lugaresMap = await extractLugares(lugaresBuffer);

  const rows = await readSheetRows(aspirantesBuffer, { sheetNameIncludes: 'ASPIRANTES' });

  const headerRowIndex = findHeaderRow(rows, ["BOLETA", "NOMBRE"]);

  if (headerRowIndex === -1) throw new Error("No se encontró la cabecera en el Excel");

  const recordsByCareer = {};

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue; // Skip empty rows

    const boleta = limpiar(row[0]);
    if (!boleta) continue;

    const nombre = limpiar(row[3]);
    const generoRaw = limpiar(row[7]).toUpperCase();
    const trueGenero = generoRaw === 'F' ? 'Mujer' : 'Hombre';

    const programaRaw = limpiar(row[9]);
    const carrera = normalizeCareer(programaRaw);
    
    const promedio = parseFloat(limpiar(row[15])) || 0;

    if (!recordsByCareer[carrera]) {
      recordsByCareer[carrera] = { all: [] };
    }

    recordsByCareer[carrera].all.push({ boleta, nombre, carrera, genero: trueGenero, promedio });
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
      Kms: 0,
      Secuencia: seq
    });
  };

  for (const carrera in recordsByCareer) {
    // Ordenar de mayor a menor promedio
    const todosOrdenados = recordsByCareer[carrera].all.sort((a, b) => b.promedio - a.promedio);
    
    // Limitar cupo según el archivo de lugares (si existe en el mapa)
    const cupo = lugaresMap[carrera] || todosOrdenados.length;
    const admitidos = todosOrdenados.slice(0, cupo);

    // Separar por género para la lógica del 60%
    const mujeres = admitidos.filter(s => s.genero === 'Mujer');
    const hombres = admitidos.filter(s => s.genero === 'Hombre');
    
    const sequences = sequenceMap[carrera] || [];
    if (sequences.length === 0) continue;

    const totalStudents = mujeres.length + hombres.length;
    const capacityPerSeq = Math.ceil(totalStudents / sequences.length);
    
    // Matutino first
    const sortedSequences = [...sequences].sort((a, b) => {
      const isAM = a[2] === 'M' ? 0 : 1;
      const isBM = b[2] === 'M' ? 0 : 1;
      if (isAM !== isBM) return isAM - isBM;
      return a.localeCompare(b);
    });

    for (const seq of sortedSequences) {
      const womenQuota = Math.ceil(capacityPerSeq * 0.60);
      let assignedCount = 0;

      // Assign women up to quota
      while (assignedCount < womenQuota && mujeres.length > 0) {
        asignar(mujeres.shift(), seq);
        assignedCount++;
      }

      // Assign men to fill the rest of the capacity
      while (assignedCount < capacityPerSeq && hombres.length > 0) {
        asignar(hombres.shift(), seq);
        assignedCount++;
      }

      // If we still have space but men are out, fill with remaining women
      while (assignedCount < capacityPerSeq && mujeres.length > 0) {
        asignar(mujeres.shift(), seq);
        assignedCount++;
      }
    }

    // If any students left (due to rounding errors), put them in the last sequence
    const lastSeq = sortedSequences[sortedSequences.length - 1];
    while (mujeres.length > 0) asignar(mujeres.shift(), lastSeq);
    while (hombres.length > 0) asignar(hombres.shift(), lastSeq);
  }

  if (finalAssignments.length === 0) {
    throw new Error("No se encontraron registros válidos para procesar. Asegúrate de que el archivo no esté vacío y contenga los encabezados correctos.");
  }

  return finalAssignments;
}

export async function exportToExcel(data, defaultFilename = 'gruposAsignados31secuencias.xlsx') {
  const XLSX = await getXLSX();
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Grupos Asignados");
  
  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [{
          description: 'Excel Workbook',
          accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']},
        }],
      });
      const writable = await fileHandle.createWritable();
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await writable.write(excelBuffer);
      await writable.close();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error guardando el archivo:', err);
      }
    }
  } else {
    // Fallback normal si el navegador no lo soporta
    XLSX.writeFile(wb, defaultFilename);
  }
}
