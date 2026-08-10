import { pickSaveTarget, discardSaveTarget, exportToExcel } from './groupGenerator';
import type { ExportResult } from './groupGenerator';
import type { AlumnoRow } from '@/types/api';

const buildRows = (alumnos: AlumnoRow[]): Record<string, unknown>[] =>
  alumnos.map((a) => ({
    Secuencia: a.secuencia ?? 'SIN GRUPO',
    Turno: a.turno === 'M' ? 'Matutino' : a.turno === 'V' ? 'Vespertino' : '',
    Carrera: a.carrera,
    PR: a.pr,
    Boleta: a.boleta ?? '',
    Nombre: a.nombre,
    Genero: a.genero === 'F' ? 'Mujer' : 'Hombre',
    Promedio: a.promedio ?? '',
    DistanciaKm: a.distanceMeters != null ? Math.round(a.distanceMeters / 100) / 10 : '',
  }));

export type ExportOutcome = ExportResult | { cancelled: true };

// Exporta una lista de alumnos (AlumnoRow del backend) a un .xlsx.
// Lanza si falla la escritura.
export async function exportAlumnos(
  alumnos: AlumnoRow[],
  filename: string,
): Promise<ExportOutcome> {
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
