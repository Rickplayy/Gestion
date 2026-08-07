import { useEffect, useState } from 'react';
import { api } from '../api/client';

function CiclosView({ onSelectCiclo, onCreateNew, onMessage }) {
  const [ciclos, setCiclos] = useState(null);

  useEffect(() => {
    api
      .listTerms()
      .then((res) => setCiclos(res.items))
      .catch((err) => onMessage({ text: `No se pudieron cargar los ciclos escolares: ${err.message}`, type: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Ciclos escolares</h2>
          <p className="muted">Selecciona un ciclo para ver sus carreras y grupos, o crea uno nuevo.</p>
        </div>
        <button className="btn-file" onClick={onCreateNew}>+ Nuevo ciclo escolar</button>
      </div>

      {ciclos === null && <p className="loading-state">Cargando…</p>}

      {ciclos !== null && ciclos.length === 0 && (
        <div className="empty-state">Aún no hay ciclos escolares registrados.</div>
      )}

      {ciclos !== null && ciclos.length > 0 && (
        <div className="entity-grid">
          {ciclos.map((ciclo) => (
            <button key={ciclo.id} className="entity-card" onClick={() => onSelectCiclo(ciclo)}>
              <div>
                <div className="entity-card__title">{ciclo.descripcion}</div>
                <div className="entity-card__meta">
                  {ciclo.carreras.length === 0 && <span className="muted">Sin carreras aún</span>}
                  {ciclo.carreras.map((carrera) => (
                    <span key={carrera.id} className="badge">{carrera.descripcion}</span>
                  ))}
                </div>
              </div>
              <span className="entity-card__chevron">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default CiclosView;
