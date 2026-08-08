import { useEffect, useState } from 'react';
import { api } from '../api/client';

function EditAlumnoModal({ alumno, term, carrera, onClose, onSaved, onMessage }) {
  const [addressMode, setAddressMode] = useState('direccion');
  const [estado, setEstado] = useState('');
  const [delegacion, setDelegacion] = useState('');
  const [cp, setCp] = useState('');
  const [calle, setCalle] = useState('');
  const [numero, setNumero] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [isRecalculando, setIsRecalculando] = useState(false);

  const [grupos, setGrupos] = useState(null);
  const [selectedGrupo, setSelectedGrupo] = useState(alumno.idGrupo == null ? 'sin-grupo' : String(alumno.idGrupo));
  const [isSavingGrupo, setIsSavingGrupo] = useState(false);

  useEffect(() => {
    api
      .getGruposPorCarrera(term.id, carrera.id)
      .then((res) => setGrupos(res.items))
      .catch((err) => onMessage({ text: `No se pudieron cargar los grupos: ${err.message}`, type: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term.id, carrera.id]);

  const direccionCompleta = estado.trim() && delegacion.trim() && cp.trim() && calle.trim() && numero.trim();
  const coordenadasCompletas = lat.trim() !== '' && lon.trim() !== '' && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon));

  const handleRecalcularDireccion = async () => {
    setIsRecalculando(true);
    try {
      await api.updateDomicilio(term.id, alumno.pr, {
        ESTADO: estado.trim(),
        DELEGACION: delegacion.trim(),
        CP: cp.trim(),
        CALLE: calle.trim(),
        NUMERO: numero.trim(),
        COLONIA: '',
      });
      await api.asignarGrupos(term.id);
      onMessage({ text: 'Dirección actualizada. Los grupos de la carrera se reacomodaron.', type: 'success' });
      onSaved();
    } catch (err) {
      onMessage({ text: `Error recalculando: ${err.message}`, type: 'error' });
    } finally {
      setIsRecalculando(false);
    }
  };

  const handleRecalcularCoordenadas = async () => {
    setIsRecalculando(true);
    try {
      await api.updateDomicilioCoordenadas(term.id, alumno.pr, { lat: Number(lat), lon: Number(lon) });
      await api.asignarGrupos(term.id);
      onMessage({ text: 'Coordenadas actualizadas. Los grupos de la carrera se reacomodaron.', type: 'success' });
      onSaved();
    } catch (err) {
      onMessage({ text: `Error recalculando: ${err.message}`, type: 'error' });
    } finally {
      setIsRecalculando(false);
    }
  };

  const handleGuardarGrupo = async () => {
    setIsSavingGrupo(true);
    try {
      const idGrupo = selectedGrupo === 'sin-grupo' ? null : Number(selectedGrupo);
      await api.updateGrupoAlumno(term.id, alumno.pr, idGrupo);
      onMessage({ text: 'Grupo actualizado.', type: 'success' });
      onSaved();
    } catch (err) {
      onMessage({ text: `Error cambiando de grupo: ${err.message}`, type: 'error' });
    } finally {
      setIsSavingGrupo(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{alumno.nombre}</h3>
            <p className="muted">PR {alumno.pr} · Boleta {alumno.boleta}</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="modal-section">
          <h4>Editar dirección</h4>
          <p className="muted" style={{ marginBottom: '0.85rem' }}>
            Distancia actual: {alumno.distanceMeters != null ? `${Math.round(alumno.distanceMeters / 100) / 10} km` : 'sin calcular'}
          </p>

          <div className="tab-toggle">
            <button
              type="button"
              className={addressMode === 'direccion' ? 'active' : ''}
              onClick={() => setAddressMode('direccion')}
            >
              Por dirección
            </button>
            <button
              type="button"
              className={addressMode === 'coordenadas' ? 'active' : ''}
              onClick={() => setAddressMode('coordenadas')}
            >
              Por coordenadas
            </button>
          </div>

          {addressMode === 'direccion' ? (
            <>
              <div className="field-grid">
                <div>
                  <label htmlFor="estado">Estado</label>
                  <input id="estado" value={estado} onChange={(e) => setEstado(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="delegacion">Delegación</label>
                  <input id="delegacion" value={delegacion} onChange={(e) => setDelegacion(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="cp">CP</label>
                  <input id="cp" value={cp} onChange={(e) => setCp(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="numero">Número</label>
                  <input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} />
                </div>
                <div className="span-2">
                  <label htmlFor="calle">Calle</label>
                  <input id="calle" value={calle} onChange={(e) => setCalle(e.target.value)} />
                </div>
              </div>
              <button className="btn-file" onClick={handleRecalcularDireccion} disabled={!direccionCompleta || isRecalculando}>
                {isRecalculando ? 'Recalculando…' : 'Recalcular'}
              </button>
            </>
          ) : (
            <>
              <div className="field-grid">
                <div>
                  <label htmlFor="lat">Latitud</label>
                  <input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Ej. 19.3960" />
                </div>
                <div>
                  <label htmlFor="lon">Longitud</label>
                  <input id="lon" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="Ej. -99.0919" />
                </div>
              </div>
              <button className="btn-file" onClick={handleRecalcularCoordenadas} disabled={!coordenadasCompletas || isRecalculando}>
                {isRecalculando ? 'Recalculando…' : 'Recalcular'}
              </button>
            </>
          )}
        </div>

        <div className="modal-section">
          <h4>Grupo</h4>
          {grupos === null ? (
            <p className="loading-state">Cargando grupos…</p>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={selectedGrupo} onChange={(e) => setSelectedGrupo(e.target.value)} style={{ flex: '1 1 200px' }}>
                <option value="sin-grupo">Sin grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.secuencia} · {g.turno === 'M' ? 'Matutino' : 'Vespertino'}
                  </option>
                ))}
              </select>
              <button className="btn-file" onClick={handleGuardarGrupo} disabled={isSavingGrupo}>
                {isSavingGrupo ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditAlumnoModal;
