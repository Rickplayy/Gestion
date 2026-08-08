import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { exportAlumnos } from '../utils/exportAlumnos';
import EditAlumnoModal from '../components/EditAlumnoModal';

function AlumnosView({ term, carrera, grupo, onBack, onMessage }) {
  const [alumnos, setAlumnos] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingAlumno, setEditingAlumno] = useState(null);

  const fetchAlumnos = () => {
    const filters = grupo.sinGrupo
      ? { carrera: [carrera.id], sinAsignar: true }
      : { secuencia: [grupo.secuencia] };
    return api
      .queryAlumnos(term.id, filters)
      .then((res) => setAlumnos(res.items))
      .catch((err) => onMessage({ text: `No se pudieron cargar los alumnos: ${err.message}`, type: 'error' }));
  };

  useEffect(() => {
    fetchAlumnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term.id, carrera.id, grupo.id]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filename = grupo.sinGrupo
        ? `${term.descripcion} - ${carrera.descripcion} - Sin grupo.xlsx`
        : `${term.descripcion} - ${grupo.secuencia}.xlsx`;
      const result = await exportAlumnos(alumnos, filename);
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

  const handleSaved = () => {
    setEditingAlumno(null);
    fetchAlumnos();
  };

  return (
    <div className="page">
      <button className="btn-back" onClick={onBack}>← Volver a Grupos</button>

      <div className="page-head">
        <div>
          <h2>{grupo.sinGrupo ? 'Alumnos sin grupo' : `Alumnos del grupo ${grupo.secuencia}`}</h2>
          <p className="muted">
            {term.descripcion} · {carrera.descripcion}
            {!grupo.sinGrupo && ` · ${grupo.turno === 'M' ? 'Matutino' : 'Vespertino'}`}
          </p>
        </div>
        <button className="btn-file" onClick={handleExport} disabled={isExporting || !alumnos?.length}>
          {isExporting ? 'Exportando…' : 'Exportar Excel'}
        </button>
      </div>

      {alumnos === null && <p className="loading-state">Cargando…</p>}

      {alumnos !== null && alumnos.length === 0 && (
        <div className="empty-state">No hay alumnos que mostrar aquí.</div>
      )}

      {alumnos !== null && alumnos.length > 0 && (
        <div className="table-scroll">
          <table className="students-table">
            <thead>
              <tr>
                <th>PR</th>
                <th>Boleta</th>
                <th>Nombre</th>
                <th>Género</th>
                <th>Promedio</th>
                <th>Distancia (km)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((alumno) => (
                <tr key={alumno.pr}>
                  <td>{alumno.pr}</td>
                  <td>{alumno.boleta ?? '—'}</td>
                  <td>{alumno.nombre}</td>
                  <td>{alumno.genero === 'F' ? 'Mujer' : 'Hombre'}</td>
                  <td>{alumno.promedio ?? '—'}</td>
                  <td>{alumno.distanceMeters != null ? Math.round(alumno.distanceMeters / 100) / 10 : '—'}</td>
                  <td>
                    <button className="btn-edit" onClick={() => setEditingAlumno(alumno)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingAlumno && (
        <EditAlumnoModal
          alumno={editingAlumno}
          term={term}
          carrera={carrera}
          onClose={() => setEditingAlumno(null)}
          onSaved={handleSaved}
          onMessage={onMessage}
        />
      )}
    </div>
  );
}

export default AlumnosView;
