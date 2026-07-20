import { useState, useEffect, useRef } from 'react';
import { parseExcelBuffer } from './utils/excelParser';
import { generateGroupsFromBuffer, exportToExcel, extractSecuencias, pickSaveFile } from './utils/groupGenerator';
import './App.css';

function App() {
  const [view, setView] = useState(() => localStorage.getItem('token') ? 'dashboard' : 'login');
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [careers, setCareers] = useState([]);
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Form States
  const [studentForm, setStudentForm] = useState({ name: '', boleta: '', careerId: '', address: '', gender: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const fileGeneratorRef = useRef(null);
  const fileSecuenciasRef = useRef(null);
  const [aspirantesFile, setAspirantesFile] = useState(null);
  const [secuenciasFile, setSecuenciasFile] = useState(null);
  const [secuenciasList, setSecuenciasList] = useState([]);
  const [defaultWomenPct, setDefaultWomenPct] = useState(50);
  const [womenPctBySeq, setWomenPctBySeq] = useState({});
  const [isSyncingAspirantes, setIsSyncingAspirantes] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Aplicar el tema al documento y recordarlo
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const API_URL = 'http://localhost:3001/api';

  const authHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  // Si el token expiró o es inválido, cerrar sesión localmente
  const handleUnauthorized = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setView('login');
    setMessage({ text: 'Tu sesión expiró, inicia sesión de nuevo', type: 'error' });
  };

  const fetchStudents = () => {
    fetch(`${API_URL}/students`, { headers: authHeaders() })
      .then(res => {
        if (res.status === 401) {
          handleUnauthorized();
          return [];
        }
        return res.json();
      })
      .then(data => setStudents(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetch(`${API_URL}/careers`)
      .then(res => res.json())
      .then(data => setCareers(data))
      .catch(err => console.error(err));

    if (isLoggedIn && view === 'dashboard') {
      fetchStudents();
    }
  }, [isLoggedIn, view]);

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(studentForm)
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        setMessage({ text: 'Alumno registrado con éxito', type: 'success' });
        setStudentForm({ name: '', boleta: '', careerId: '', address: '', gender: '' });
        fetchStudents(); // Reflejar el registro en el apartado Alumnos
      } else {
        const err = await res.json();
        setMessage({ text: err.error, type: 'error' });
      }
    } catch {
      setMessage({ text: 'Error de conexión', type: 'error' });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setIsLoggedIn(true);
        setView('dashboard');
        setMessage({ text: 'Bienvenido, Administrador', type: 'success' });
      } else {
        setMessage({ text: data.error, type: 'error' });
      }
    } catch {
      setMessage({ text: 'Error al iniciar sesión', type: 'error' });
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setView('login');
    setMessage({ text: 'Sesión cerrada', type: 'success' });
  };

  // Al seleccionar el archivo de Aspirantes (Nuevo-ingreso.xlsx) en el
  // Generador: se guarda el archivo para la generación de grupos Y se sincroniza
  // su resumen (nombre, boleta, sexo, carrera, domicilio) a la tabla de Alumnos.
  // El apartado Alumnos es solo lectura; sus datos vienen de aquí.
  const handleAspirantesSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAspirantesFile(file);

    setIsSyncingAspirantes(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsedData = await parseExcelBuffer(buffer);

      const res = await fetch(`${API_URL}/students/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(parsedData)
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: `Aspirantes cargados. ${data.message} Ya se ven en el apartado Alumnos.`, type: 'success' });
        fetchStudents();
      } else {
        setMessage({ text: data.error || 'Error al procesar el archivo de aspirantes', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error procesando el archivo: ' + err.message, type: 'error' });
    } finally {
      setIsSyncingAspirantes(false);
    }
  };

  // Al seleccionar el archivo de Secuencias se parsea de inmediato para
  // mostrar el resumen de cupos y habilitar el editor de % por secuencia.
  const handleSecuenciasSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const list = await extractSecuencias(buffer);
      setSecuenciasFile(file);
      setSecuenciasList(list);
      setWomenPctBySeq({});
      setMessage({ text: `Archivo de secuencias cargado: ${list.length} secuencias, cupo total ${list.reduce((s, x) => s + x.cupo, 0)}.`, type: 'success' });
    } catch (err) {
      setSecuenciasFile(null);
      setSecuenciasList([]);
      setMessage({ text: 'Error leyendo el archivo de secuencias: ' + err.message, type: 'error' });
    }
  };

  const clampPct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

  const handleGenerateExcel = async () => {
    if (!aspirantesFile || !secuenciasFile) {
      setMessage({ text: 'Por favor selecciona ambos archivos.', type: 'error' });
      return;
    }

    try {
      // El diálogo "Guardar como" se abre PRIMERO (dentro del click del usuario):
      // el usuario elige nombre y ubicación antes de procesar. Abrirlo después
      // del procesamiento invalida el gesto y deja el archivo dañado/vacío.
      const fileHandle = await pickSaveFile('gruposAsignados.xlsx');
      if (fileHandle && fileHandle.cancelled) {
        setMessage({ text: 'Guardado cancelado.', type: 'error' });
        return;
      }

      setIsGenerating(true);
      setMessage({ text: 'Procesando archivos y generando secuencias...', type: 'success' });

      const aspirantesBuffer = await aspirantesFile.arrayBuffer();
      const secuenciasBuffer = await secuenciasFile.arrayBuffer();
      const generatedData = await generateGroupsFromBuffer(aspirantesBuffer, secuenciasBuffer, {
        defaultWomenPct: clampPct(defaultWomenPct),
        womenPctBySeq,
      });
      const savedName = await exportToExcel(generatedData, 'gruposAsignados.xlsx', fileHandle);
      setMessage({ text: `"${savedName}" guardado con ${generatedData.length} alumnos asignados.`, type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error generando el archivo: ' + err.message, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtro de búsqueda del apartado Alumnos
  const filteredStudents = students.filter(s => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.boleta || '').toLowerCase().includes(q) ||
      String(s.Career?.name || '').toLowerCase().includes(q) ||
      String(s.gender || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="logo">SISTEMA GESTIÓN IPN</div>
        <div className="nav-links">
          {!isLoggedIn ? (
            <button onClick={() => setView('login')} className={view === 'login' ? 'active' : ''}>Admin Login</button>
          ) : (
            <>
              <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'active' : ''}>Alumnos</button>
              <button onClick={() => setView('register')} className={view === 'register' ? 'active' : ''}>Registro</button>
              <button onClick={() => setView('generator')} className={view === 'generator' ? 'active' : ''}>Generador Grupos</button>
              <button onClick={logout}>Cerrar Sesión</button>
            </>
          )}
        </div>
      </nav>

      <main>
        {message.text && (
          <div className={`status-msg ${message.type}`}>
            {message.text}
            <button className="close-btn" onClick={() => setMessage({text:'', type:''})}>X</button>
          </div>
        )}

        {view === 'register' && isLoggedIn && (
          <div className="dashboard-container">
            <div className="login-card" style={{maxWidth: '500px', margin: '0 auto'}}>
              <h2>Registro de Nuevo Alumno</h2>
              <form onSubmit={handleStudentSubmit}>
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input type="text" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Boleta</label>
                  <input type="text" value={studentForm.boleta} onChange={e => setStudentForm({...studentForm, boleta: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Sexo</label>
                  <select value={studentForm.gender} onChange={e => setStudentForm({...studentForm, gender: e.target.value})} required>
                    <option value="">Seleccione sexo</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Carrera</label>
                  <select value={studentForm.careerId} onChange={e => setStudentForm({...studentForm, careerId: e.target.value})} required>
                    <option value="">Seleccione carrera</option>
                    {careers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Dirección</label>
                  <textarea value={studentForm.address} onChange={e => setStudentForm({...studentForm, address: e.target.value})} required />
                </div>
                <button type="submit" className="btn-primary">Registrar</button>
              </form>
            </div>
          </div>
        )}

        {view === 'login' && (
          <div className="login-container">
            <div className="login-card">
              <h2>Panel de Administrador</h2>
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Usuario</label>
                  <input type="text" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <input type="password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required />
                </div>
                <button type="submit" className="btn-primary">Entrar</button>
              </form>
            </div>
          </div>
        )}

        {view === 'dashboard' && isLoggedIn && (
          <div className="dashboard-container">
            <h2>Listado de Alumnos</h2>
            <p className="muted" style={{ marginTop: '-0.5rem' }}>
              Resumen de los datos del archivo Nuevo-ingreso.xlsx. Para cargar o actualizar
              estos datos, sube el archivo de aspirantes en <strong>Generador Grupos</strong>.
            </p>

            <div style={{ margin: '1rem 0' }}>
              <input
                type="search"
                className="search-input"
                placeholder="Buscar por nombre, boleta, carrera o sexo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <span className="muted" style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>
                {filteredStudents.length} de {students.length} alumnos
              </span>
            </div>

            <div className="table-scroll">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Boleta</th>
                    <th>Sexo</th>
                    <th>Carrera</th>
                    <th>Dirección</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.boleta}</td>
                      <td>{s.gender || '—'}</td>
                      <td>{s.Career?.name}</td>
                      <td>{s.address}</td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan="5" className="faint" style={{ textAlign: 'center' }}>
                        {students.length === 0 ? 'No hay alumnos registrados' : 'Sin resultados para la búsqueda'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'generator' && isLoggedIn && (
          <div className="dashboard-container">
            <div className="login-card" style={{maxWidth: '700px', margin: '0 auto', textAlign: 'center'}}>
              <h2>Generador de Secuencias</h2>
              <p>Sube el archivo de Aspirantes y el archivo de Secuencias (cupos) para asignar grupos.</p>

              <div className="panel">
                <div style={{ marginBottom: '1rem' }}>
                  <strong>1. Archivo de Aspirantes Inscritos</strong> (ej. Nuevo-ingreso-261.xlsx)<br/>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>Al seleccionarlo se actualiza también el apartado Alumnos.</span><br/>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    ref={fileGeneratorRef}
                    style={{ display: 'none' }}
                    onChange={handleAspirantesSelect}
                  />
                  <button className="btn-primary" onClick={() => fileGeneratorRef.current?.click()} disabled={isSyncingAspirantes} style={{ width: 'auto', padding: '0.5rem 1rem', marginTop: '0.5rem' }}>
                    {isSyncingAspirantes ? 'Cargando...' : 'Seleccionar'}
                  </button>
                  <span style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>{aspirantesFile ? aspirantesFile.name : 'Ningún archivo seleccionado'}</span>
                </div>

                <div>
                  <strong>2. Archivo de Secuencias con cupos</strong> (ej. Secuencias primer semestre 26-2.xlsx)<br/>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    ref={fileSecuenciasRef}
                    style={{ display: 'none' }}
                    onChange={handleSecuenciasSelect}
                  />
                  <button className="btn-primary" onClick={() => fileSecuenciasRef.current?.click()} style={{ width: 'auto', padding: '0.5rem 1rem', marginTop: '0.5rem' }}>Seleccionar</button>
                  <span style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>{secuenciasFile ? secuenciasFile.name : 'Ningún archivo seleccionado'}</span>
                </div>
              </div>

              {/* Distribución por sexo */}
              <div className="panel">
                <strong>3. Distribución por sexo en cada secuencia</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <label style={{ fontWeight: 'normal' }}>
                    Mujeres:{' '}
                    <input
                      type="number" min="0" max="100"
                      value={defaultWomenPct}
                      onChange={e => setDefaultWomenPct(clampPct(e.target.value))}
                      style={{ width: '80px', display: 'inline-block' }}
                    /> %
                  </label>
                  <span>Hombres: <strong>{100 - clampPct(defaultWomenPct)}%</strong></span>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>(predeterminado 50% / 50%)</span>
                </div>

                {secuenciasList.length > 0 && (
                  <details className="pct-editor" style={{ marginTop: '0.75rem' }}>
                    <summary>Personalizar porcentaje por secuencia ({secuenciasList.length} secuencias)</summary>
                    <div className="pct-scroll">
                      <table className="pct-table">
                        <thead>
                          <tr>
                            <th>Secuencia</th>
                            <th>Turno</th>
                            <th>Carrera</th>
                            <th>Cupo</th>
                            <th>% Mujeres</th>
                            <th>% Hombres</th>
                          </tr>
                        </thead>
                        <tbody>
                          {secuenciasList.map(s => {
                            const pct = womenPctBySeq[s.secuencia] ?? clampPct(defaultWomenPct);
                            return (
                              <tr key={s.secuencia}>
                                <td><strong>{s.secuencia}</strong></td>
                                <td>{s.turno}</td>
                                <td style={{ fontSize: '0.8rem' }}>{s.carrera}</td>
                                <td>{s.cupo}</td>
                                <td>
                                  <input
                                    type="number" min="0" max="100"
                                    value={pct}
                                    onChange={e => setWomenPctBySeq({ ...womenPctBySeq, [s.secuencia]: clampPct(e.target.value) })}
                                  />
                                </td>
                                <td>{100 - pct}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {Object.keys(womenPctBySeq).length > 0 && (
                      <button className="btn-outline" onClick={() => setWomenPctBySeq({})}>
                        Restablecer todos al {clampPct(defaultWomenPct)}%
                      </button>
                    )}
                  </details>
                )}
              </div>

              {/* Espacio reservado: API de kilómetros (aún no disponible) */}
              <div className="panel panel-placeholder">
                <strong>4. Distancia y preferencia de turno</strong> <em>(próximamente)</em>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                  Aquí se conectará la API que calcula los kilómetros del domicilio de cada aspirante:
                  entre más lejos viva, mayor preferencia tendrá para el turno matutino.
                </p>
              </div>

              <button
                  className="btn-primary"
                  onClick={handleGenerateExcel}
                  disabled={isGenerating || !aspirantesFile || !secuenciasFile}
                  style={{ padding: '1rem', fontSize: '1.2rem', marginTop: '2rem' }}
                >
                  {isGenerating ? 'Generando...' : 'Procesar y Descargar'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Botón flotante para cambiar entre tema claro y oscuro */}
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
