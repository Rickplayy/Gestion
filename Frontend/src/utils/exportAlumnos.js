import { pickSaveTarget, discardSaveTarget, exportToExcel } from './groupGenerator';

const buildRows = (alumnos) =>
  alumnos.map((a) => ({
    Secuencia: a.secuencia ?? 'SIN GRUPO',
    Turno: a.turno === 'M' ? 'Matutino' : a.turno === 'V' ? 'Vespertino' : '',
    Carrera: a.carrera,
    PR: a.pr,
    Nombre: a.nombre,
    Genero: a.genero === 'F' ? 'Mujer' : 'Hombre',
    Promedio: a.promedio ?? '',
    DistanciaKm: a.distanceMeters != null ? Math.round(a.distanceMeters / 100) / 10 : '',
  }));

// Exporta una lista de alumnos (AlumnoRow del backend) a un .xlsx.
// Regresa { cancelled: true } | { name, location } y lanza si falla la escritura.
export async function exportAlumnos(alumnos, filename) {
  if (alumnos.length === 0) {
    throw new Error('No hay alumnos para exportar.');
  }

  const target = await pickSaveTarget(filename);
  if (target?.cancelled) {
    return { cancelled: true };
  }

  try {
    return await exportToExcel(buildRows(alumnos), filename, target);
  } catch (err) {
    await discardSaveTarget(target);
    throw err;
  }
}
