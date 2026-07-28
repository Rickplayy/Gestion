import { useState, useEffect, useRef } from 'react';
import { api, getToken, setToken } from './api/client';
import { parseExcelBuffer } from './utils/excelParser';
import { extractSecuencias, pickSaveTarget, discardSaveTarget, exportToExcel } from './utils/groupGenerator';
import { buildGruposPayload, buildAlumnosPayload } from './utils/mapToBackend';
import './App.css';

function LoginForm({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.login(username, password);
      setToken(token);
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>Sistema Gestión IPN</h2>
        <div className="form-group">
          <label htmlFor="username">Usuario</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="status-msg error">{error}</div>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

function App() {
  const [message, setMessage] = useState({ text: '', type: '' });
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const [carreras, setCarreras] = useState([]);

  const [termDescripcion, setTermDescripcion] = useState('');
  const [termId, setTermId] = useState(null);
  const [manualTermId, setManualTermId] = useState('');
  const [isCreatingTerm, setIsCreatingTerm] = useState(false);

  const fileSecuenciasRef = useRef(null);
  const [secuenciasFile, setSecuenciasFile] = useState(null);
  const [gruposResumen, setGruposResumen] = useState(null);
  const [isUploadingGrupos, setIsUploadingGrupos] = useState(false);

  const fileAspirantesRef = useRef(null);
  const [aspirantesFile, setAspirantesFile] = useState(null);
  const [alumnosResumen, setAlumnosResumen] = useState(null);
  const [isUploadingAlumnos, setIsUploadingAlumnos] = useState(false);

  const [conteo, setConteo] = useState(null);
  const [isLoadingConteo, setIsLoadingConteo] = useState(false);
  const [isAsignando, setIsAsignando] = useState(false);

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!authed) return;
    api
      .getCarreras()
      .then((res) => setCarreras(res.items))
      .catch((err) => setMessage({ text: `No se pudo cargar el catálogo de carreras: ${err.message}`, type: 'error' }));
  }, [authed]);

  const handleLogout = () => {
    setToken(null);
    setAuthed(false);
  };

  if (!authed) {
    return <LoginForm onLoggedIn={() => setAuthed(true)} />;
  }

  const handleCreateTerm = async (e) => {
    e.preventDefault();
    setIsCreatingTerm(true);
    try {
      const term = await api.createTerm(termDescripcion.trim());
      setTermId(term.id);
      setMessage({ text: `Ciclo escolar "${term.descripcion}" creado (id ${term.id}).`, type: 'success' });
    } catch (err) {
      setMessage({ text: `Error creando el ciclo: ${err.message}`, type: 'error' });
    } finally {
      setIsCreatingTerm(false);
    }
  };

  const handleUseExistingTerm = (e) => {
    e.preventDefault();
    const id = Number.parseInt(manualTermId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      setMessage({ text: 'Ingresa un id de ciclo escolar válido.', type: 'error' });
      return;
    }
    setTermId(id);
    setMessage({ text: `Usando ciclo escolar existente (id ${id}).`, type: 'success' });
  };

  const handleSecuenciasSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSecuenciasFile(file);
    setGruposResumen(null);
    setIsUploadingGrupos(true);
    try {
      const buffer = await file.arrayBuffer();
      const list = await extractSecuencias(buffer);
      const { validos, omitidos } = buildGruposPayload(list, carreras);
      if (validos.length === 0) {
        throw new Error('Ninguna secuencia se pudo mapear a una carrera/turno válidos.');
      }
      const result = await api.createGrupos(termId, validos);
      setGruposResumen({ creados: result.items.length, omitidos });
      setMessage({
        text: `${result.items.length} grupo(s) creados${omitidos.length ? `, ${omitidos.length} omitido(s)` : ''}.`,
        type: 'success',
      });
    } catch (err) {
      setMessage({ text: `Error procesando secuencias: ${err.message}`, type: 'error' });
    } finally {
      setIsUploadingGrupos(false);
    }
  };

  const handleAspirantesSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAspirantesFile(file);
    setAlumnosResumen(null);
    setIsUploadingAlumnos(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseExcelBuffer(buffer);
      const { validos, omitidos } = buildAlumnosPayload(parsed, carreras);
      if (validos.length === 0) {
        throw new Error('Ningún aspirante se pudo mapear correctamente.');
      }
      const result = await api.createAlumnos(termId, validos);
      setAlumnosResumen({ ...result, omitidosLocal: omitidos });
      setMessage({
        text: `${result.insertados} alumno(s) insertados, ${result.duplicados.length} duplicado(s), ${result.fallidos.length} fallido(s), ${omitidos.length} omitido(s) antes de enviar.`,
        type: 'success',
      });
    } catch (err) {
      setMessage({ text: `Error procesando aspirantes: ${err.message}`, type: 'error' });
    } finally {
      setIsUploadingAlumnos(false);
    }
  };

  const handleConteo = async () => {
    setIsLoadingConteo(true);
    try {
      const result = await api.getConteo(termId);
      setConteo(result);
    } catch (err) {
      setMessage({ text: `Error obteniendo el conteo: ${err.message}`, type: 'error' });
    } finally {
      setIsLoadingConteo(false);
    }
  };

  const handleAsignarYExportar = async () => {
    const target = await pickSaveTarget('gruposAsignados.xlsx');
    if (target?.cancelled) {
      setMessage({ text: 'Guardado cancelado.', type: 'error' });
      return;
    }

    setIsAsignando(true);
    try {
      await api.asignarGrupos(termId);
      const grupos = await api.getGrupos(termId);

      const rows = [];
      for (const grupo of grupos.items) {
        for (const alumno of grupo.alumnos) {
          rows.push({
            Secuencia: grupo.secuencia,
            Turno: grupo.turno === 'M' ? 'Matutino' : 'Vespertino',
            Carrera: grupo.carrera,
            PR: alumno.pr,
            Nombre: alumno.nombre,
            Genero: alumno.genero === 'F' ? 'Mujer' : 'Hombre',
            Promedio: alumno.promedio ?? '',
            DistanciaKm: alumno.distanceMeters != null ? Math.round(alumno.distanceMeters / 100) / 10 : '',
          });
        }
      }

      if (rows.length === 0) {
        throw new Error('No quedó ningún alumno asignado a un grupo.');
      }

      const saved = await exportToExcel(rows, 'gruposAsignados.xlsx', target);
      setMessage({
        text: saved.location === 'descargas'
          ? `"${saved.name}" se descargó a tu carpeta de Descargas con ${rows.length} alumnos asignados.`
          : `"${saved.name}" guardado con ${rows.length} alumnos asignados.`,
        type: 'success',
      });
    } catch (err) {
      await discardSaveTarget(target);
      setMessage({ text: `Error asignando/exportando: ${err.message}`, type: 'error' });
    } finally {
      setIsAsignando(false);
    }
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="brand">
          <div className="logo">SISTEMA GESTIÓN IPN</div>
          <div className="app-title">Generador Grupos</div>
        </div>
        <button className="btn-outline" onClick={handleLogout}>Salir</button>
      </nav>

      <main>
        {message.text && (
          <div className={`status-msg ${message.type}`}>
            <span>{message.text}</span>
            <button className="close-btn" onClick={() => setMessage({ text: '', type: '' })} aria-label="Cerrar">×</button>
          </div>
        )}

        <div className="dashboard-container generator">
          <header className="generator-head">
            <h2>Generador de Secuencias</h2>
            <p className="muted">Sigue los pasos para asignar los grupos a partir de tus archivos de Excel.</p>
          </header>

          {/* Paso 1: Ciclo escolar */}
          <section className={`step-card ${termId ? 'is-done' : ''}`}>
            <div className="step-head">
              <span className="step-num">{termId ? '✓' : '1'}</span>
              <div className="step-title">
                <h3>Ciclo escolar</h3>
                <p className="muted">Crea el ciclo escolar de este proceso, o usa uno ya existente.</p>
              </div>
            </div>
            <div className="step-body">
              {termId ? (
                <p>Ciclo escolar activo: <strong>id {termId}</strong></p>
              ) : (
                <>
                  <form onSubmit={handleCreateTerm} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                      placeholder="Ej. 2026-1"
                      value={termDescripcion}
                      onChange={(e) => setTermDescripcion(e.target.value)}
                      required
                    />
                    <button className="btn-file" type="submit" disabled={isCreatingTerm}>
                      {isCreatingTerm ? 'Creando…' : 'Crear ciclo'}
                    </button>
                  </form>
                  <form onSubmit={handleUseExistingTerm} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      placeholder="O ingresa un id de ciclo existente"
                      value={manualTermId}
                      onChange={(e) => setManualTermId(e.target.value)}
                    />
                    <button className="btn-outline" type="submit">Usar</button>
                  </form>
                </>
              )}
            </div>
          </section>

          {/* Paso 2: Secuencias -> Grupos */}
          <section className={`step-card ${gruposResumen ? 'is-done' : ''}`}>
            <div className="step-head">
              <span className="step-num">{gruposResumen ? '✓' : '2'}</span>
              <div className="step-title">
                <h3>Archivo de Secuencias con cupos</h3>
                <p className="muted">Define los grupos disponibles y su cupo por carrera.</p>
              </div>
            </div>
            <div className="step-body">
              <input
                type="file"
                accept=".xlsx, .xls"
                ref={fileSecuenciasRef}
                style={{ display: 'none' }}
                onChange={handleSecuenciasSelect}
              />
              <button
                className="btn-file"
                onClick={() => fileSecuenciasRef.current?.click()}
                disabled={!termId || isUploadingGrupos}
              >
                {isUploadingGrupos ? 'Subiendo…' : 'Seleccionar archivo'}
              </button>
              <span className={`file-name ${secuenciasFile ? 'has-file' : ''}`}>
                {secuenciasFile ? secuenciasFile.name : 'Ningún archivo seleccionado'}
              </span>
              {gruposResumen?.omitidos.length > 0 && (
                <details className="panel" style={{ marginTop: '0.75rem' }}>
                  <summary>{gruposResumen.omitidos.length} secuencia(s) omitida(s)</summary>
                  <ul>
                    {gruposResumen.omitidos.map((o, i) => (
                      <li key={i}>{o.secuencia}: {o.motivo}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>

          {/* Paso 3: Aspirantes -> Alumnos */}
          <section className={`step-card ${alumnosResumen ? 'is-done' : ''}`}>
            <div className="step-head">
              <span className="step-num">{alumnosResumen ? '✓' : '3'}</span>
              <div className="step-title">
                <h3>Archivo de Aspirantes inscritos</h3>
                <p className="muted">Se registran en el ciclo escolar y se les calcula distancia a UPIICSA.</p>
              </div>
            </div>
            <div className="step-body">
              <input
                type="file"
                accept=".xlsx, .xls"
                ref={fileAspirantesRef}
                style={{ display: 'none' }}
                onChange={handleAspirantesSelect}
              />
              <button
                className="btn-file"
                onClick={() => fileAspirantesRef.current?.click()}
                disabled={!termId || isUploadingAlumnos}
              >
                {isUploadingAlumnos ? 'Subiendo…' : 'Seleccionar archivo'}
              </button>
              <span className={`file-name ${aspirantesFile ? 'has-file' : ''}`}>
                {aspirantesFile ? aspirantesFile.name : 'Ningún archivo seleccionado'}
              </span>
              {alumnosResumen && (
                <div className="panel" style={{ marginTop: '0.75rem' }}>
                  <p>Total en archivo: {alumnosResumen.total} · Insertados: {alumnosResumen.insertados} ·
                    {' '}Duplicados: {alumnosResumen.duplicados.length} · Fallidos: {alumnosResumen.fallidos.length} ·
                    {' '}Omitidos antes de enviar: {alumnosResumen.omitidosLocal.length}</p>
                  {(alumnosResumen.fallidos.length > 0 || alumnosResumen.omitidosLocal.length > 0) && (
                    <details>
                      <summary>Ver detalle de los que no se insertaron</summary>
                      <ul>
                        {alumnosResumen.fallidos.map((f, i) => <li key={`f${i}`}>{f.pr}: {f.motivo}</li>)}
                        {alumnosResumen.omitidosLocal.map((o, i) => <li key={`o${i}`}>{o.pr ?? '(sin PR)'}: {o.motivo}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Paso 4: Conteo */}
          <section className="step-card">
            <div className="step-head">
              <span className="step-num">4</span>
              <div className="step-title">
                <h3>Conteo por carrera</h3>
                <p className="muted">Revisa cuántos alumnos hay registrados antes de asignar grupos.</p>
              </div>
            </div>
            <div className="step-body">
              <button className="btn-file" onClick={handleConteo} disabled={!termId || isLoadingConteo}>
                {isLoadingConteo ? 'Consultando…' : 'Ver conteo'}
              </button>
              {conteo && (
                <div className="table-scroll" style={{ marginTop: '0.75rem' }}>
                  <table className="students-table">
                    <thead>
                      <tr><th>Carrera</th><th>Total</th><th>Hombres</th><th>Mujeres</th></tr>
                    </thead>
                    <tbody>
                      {conteo.carreras.map((c) => (
                        <tr key={c.idCarrera}>
                          <td>{c.descripcion}</td><td>{c.total}</td><td>{c.hombres}</td><td>{c.mujeres}</td>
                        </tr>
                      ))}
                      <tr><td><strong>Total</strong></td><td>{conteo.total}</td><td>{conteo.hombres}</td><td>{conteo.mujeres}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <button
            className="btn-generate"
            onClick={handleAsignarYExportar}
            disabled={isAsignando || !termId}
          >
            {isAsignando ? 'Asignando…' : 'Asignar grupos y exportar Excel'}
          </button>
        </div>
      </main>

      <button
        className="theme-toggle"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        title={theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
        aria-label="Cambiar tema"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
  );
}

export default App;
