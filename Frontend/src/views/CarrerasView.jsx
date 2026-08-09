import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { exportAlumnos } from '../utils/exportAlumnos';
import HeadTotals from '../components/HeadTotals';

function CarrerasView({ term, onSelectCarrera, onBack, onMessage }) {
  const [carreras, setCarreras] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const totales = carreras === null
    ? null
    : carreras.reduce(
        (acc, carrera) => ({
          grupos: acc.grupos + carrera.totalGrupos,
          alumnos: acc.alumnos + carrera.totalAlumnos,
          hombres: acc.hombres + carrera.hombres,
          mujeres: acc.mujeres + carrera.mujeres,
        }),
        { grupos: 0, alumnos: 0, hombres: 0, mujeres: 0 },
      );

  useEffect(() => {
    api
      .getCarrerasPorCiclo(term.id)
      .then((res) => setCarreras(res.items))
      .catch((err) => onMessage({ text: `No se pudieron cargar las carreras: ${err.message}`, type: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term.id]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const alumnos = await api.queryAlumnos(term.id);
      const result = await exportAlumnos(alumnos.items, `${term.descripcion}.xlsx`);
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
      <button className="btn-back" onClick={onBack}>← Volver a Ciclos</button>

      <div className="page-head">
        <div>
          <h2>Carreras</h2>
          <p className="muted">Ciclo escolar: {term.descripcion}</p>
          <HeadTotals
            stats={[
              { label: carreras?.length === 1 ? 'carrera' : 'carreras', value: carreras?.length ?? null },
              { label: 'grupos', value: totales?.grupos ?? null },
              { label: 'alumnos', value: totales?.alumnos ?? null },
              { label: 'hombres', value: totales?.hombres ?? null },
              { label: 'mujeres', value: totales?.mujeres ?? null },
            ]}
          />
        </div>
        <button className="btn-file" onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exportando…' : 'Exportar Excel del ciclo'}
        </button>
      </div>

      {carreras === null && <p className="loading-state">Cargando…</p>}

      {carreras !== null && carreras.length === 0 && (
        <div className="empty-state">Este ciclo aún no tiene grupos creados para ninguna carrera.</div>
      )}

      {carreras !== null && carreras.length > 0 && (
        <div className="entity-grid">
          {carreras.map((carrera) => (
            <button key={carrera.id} className="entity-card" onClick={() => onSelectCarrera(carrera)}>
              <div>
                <div className="entity-card__title">{carrera.descripcion}</div>
                <div className="entity-card__meta">
                  <span className="badge">{carrera.totalGrupos} grupo{carrera.totalGrupos === 1 ? '' : 's'}</span>
                  <span className="badge">{carrera.totalAlumnos} alumno{carrera.totalAlumnos === 1 ? '' : 's'}</span>
                  <span className="badge">{carrera.hombres} hombres</span>
                  <span className="badge">{carrera.mujeres} mujeres</span>
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

export default CarrerasView;
