import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { exportAlumnos } from '../utils/exportAlumnos';

function AlumnosView({ term, carrera, grupo, onBack, onMessage }) {
  const [alumnos, setAlumnos] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    api
      .queryAlumnos(term.id, { secuencia: [grupo.secuencia] })
      .then((res) => setAlumnos(res.items))
      .catch((err) => onMessage({ text: `No se pudieron cargar los alumnos: ${err.message}`, type: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term.id, grupo.secuencia]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportAlumnos(alumnos, `${term.descripcion} - ${grupo.secuencia}.xlsx`);
      if (result.cancelled) {
        onMessage({ text: 'Exportación cancelada.', type: 'error' });
        return;
      }
      onMessage({
        text: result.location === 'descargas'
          ? `"${result.name}" se descargó a tu carpeta de Descargas.`
          : `"${result.name}" guardado.`,
        type: 'success',
      });
    } catch (err) {
      onMessage({ text: `Error exportando: ${err.message}`, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="page">
      <button className="btn-back" onClick={onBack}>← Volver a Grupos</button>

      <div className="page-head">
        <div>
          <h2>Alumnos del grupo {grupo.secuencia}</h2>
          <p className="muted">{term.descripcion} · {carrera.descripcion} · {grupo.turno === 'M' ? 'Matutino' : 'Vespertino'}</p>
        </div>
        <button className="btn-file" onClick={handleExport} disabled={isExporting || !alumnos?.length}>
          {isExporting ? 'Exportando…' : 'Exportar Excel del grupo'}
        </button>
      </div>

      {alumnos === null && <p className="loading-state">Cargando…</p>}

      {alumnos !== null && alumnos.length === 0 && (
        <div className="empty-state">Este grupo no tiene alumnos registrados.</div>
      )}

      {alumnos !== null && alumnos.length > 0 && (
        <div className="table-scroll">
          <table className="students-table">
            <thead>
              <tr>
                <th>PR</th>
                <th>Nombre</th>
                <th>Género</th>
                <th>Promedio</th>
                <th>Distancia (km)</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((alumno) => (
                <tr key={alumno.pr}>
                  <td>{alumno.pr}</td>
                  <td>{alumno.nombre}</td>
                  <td>{alumno.genero === 'F' ? 'Mujer' : 'Hombre'}</td>
                  <td>{alumno.promedio ?? '—'}</td>
                  <td>{alumno.distanceMeters != null ? Math.round(alumno.distanceMeters / 100) / 10 : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AlumnosView;
