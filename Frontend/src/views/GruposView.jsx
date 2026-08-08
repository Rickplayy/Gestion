import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { exportAlumnos } from '../utils/exportAlumnos';

function GruposView({ term, carrera, onSelectGrupo, onBack, onMessage }) {
  const [grupos, setGrupos] = useState(null);
  const [sinGrupo, setSinGrupo] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    api
      .getGruposPorCarrera(term.id, carrera.id)
      .then((res) => setGrupos(res.items))
      .catch((err) => onMessage({ text: `No se pudieron cargar los grupos: ${err.message}`, type: 'error' }));
    api
      .queryAlumnos(term.id, { carrera: [carrera.id], sinAsignar: true })
      .then((res) => setSinGrupo(res.total))
      .catch((err) => onMessage({ text: `No se pudo cargar el conteo de alumnos sin grupo: ${err.message}`, type: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term.id, carrera.id]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const alumnos = await api.queryAlumnos(term.id, { carrera: [carrera.id] });
      const result = await exportAlumnos(alumnos.items, `${term.descripcion} - ${carrera.descripcion}.xlsx`);
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
      <button className="btn-back" onClick={onBack}>← Volver a Carreras</button>

      <div className="page-head">
        <div>
          <h2>Grupos</h2>
          <p className="muted">{term.descripcion} · {carrera.descripcion}</p>
        </div>
        <button className="btn-file" onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exportando…' : 'Exportar Excel de la carrera'}
        </button>
      </div>

      {grupos === null && <p className="loading-state">Cargando…</p>}

      {grupos !== null && grupos.length === 0 && sinGrupo === 0 && (
        <div className="empty-state">Esta carrera no tiene grupos en este ciclo.</div>
      )}

      {grupos !== null && (grupos.length > 0 || sinGrupo > 0) && (
        <div className="entity-grid">
          {grupos.map((grupo) => (
            <button key={grupo.id} className="entity-card" onClick={() => onSelectGrupo(grupo)}>
              <div>
                <div className="entity-card__title">{grupo.secuencia}</div>
                <div className="entity-card__meta">
                  <span className="badge">{grupo.turno === 'M' ? 'Matutino' : 'Vespertino'}</span>
                  <span className="badge">{grupo.totalAlumnos} / {grupo.cupo} alumnos</span>
                </div>
              </div>
              <span className="entity-card__chevron">›</span>
            </button>
          ))}

          {sinGrupo !== null && sinGrupo > 0 && (
            <button
              className="entity-card"
              onClick={() => onSelectGrupo({ id: 'sin-grupo', secuencia: null, turno: null, cupo: null, sinGrupo: true })}
            >
              <div>
                <div className="entity-card__title">Sin grupo</div>
                <div className="entity-card__meta">
                  <span className="badge">{sinGrupo} alumno{sinGrupo === 1 ? '' : 's'}</span>
                </div>
              </div>
              <span className="entity-card__chevron">›</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default GruposView;
