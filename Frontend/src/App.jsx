import { useState, useEffect, useRef } from 'react';
import { parseExcelBuffer } from './utils/excelParser';
import {
  generateGroupsFromBuffer,
  exportToExcel,
  extractSecuencias,
  pickSaveFile,
  normalizeCareer,
} from './utils/groupGenerator';
import './App.css';

// Carreras disponibles para el registro manual. Ya no vienen de la base de
// datos: la app funciona 100% en el navegador y sin persistencia.
const CAREERS = [
  'Ingeniería en Informática',
  'Ciencias de la Informática',
  'Ingeniería Ferroviaria',
  'Ingeniería Industrial',
  'Administración Industrial',
];

// Convierte los registros crudos del Excel de aspirantes a filas de la tabla
// de Alumnos (nombre, boleta, sexo, carrera, dirección). Deduplica por boleta.
const mapAspirantesToStudents = (parsed) => {
  const byBoleta = new Map();
  for (const r of parsed) {
    const generoRaw = String(r.GENERO || '').trim().toUpperCase();
    let gender = '—';
    if (generoRaw === 'F' || generoRaw === 'FEMENINO') gender = 'Femenino';
    else if (generoRaw === 'M' || generoRaw === 'MASCULINO') gender = 'Masculino';

    // Algunos aspirantes aún no tienen boleta: se usa la CURP como identidad.
    const boletaRaw = String(r.BOLETA || '').trim();
    const curp = String(r.CURP || '').trim();
    const identidad = boletaRaw || (curp ? `SB-${curp}` : '');
    if (!identidad) continue;

    byBoleta.set(identidad, {
      id: identidad,
      name: String(r.NOMBRE || 'Sin nombre').trim(),
      boleta: identidad,
      gender,
      career: normalizeCareer(r.PROGRAMA_EDUCATIVO),
      address: String(r.DOMICILIO || 'Sin dirección').trim(),
    });
  }
  return [...byBoleta.values()];
};

function App() {
  // La app abre directo en el generador (sin inicio de sesión).
  const [view, setView] = useState('generator');
  // Los alumnos viven solo en memoria: al recargar la página se empieza de 0.
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Formulario de registro manual
  const [studentForm, setStudentForm] = useState({ name: '', boleta: '', career: '', address: '', gender: '' });

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

  // Aplicar el tema al documento y recordarlo (única preferencia que se guarda)
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleStudentSubmit = (e) => {
    e.preventDefault();
    const name = studentForm.name.trim();
    const boleta = studentForm.boleta.trim();
    const address = studentForm.address.trim();

    if (!name || !boleta || !address || !studentForm.career || !studentForm.gender) {
      setMessage({ text: 'Completa todos los campos.', type: 'error' });
      return;
    }
    if (students.some(s => s.boleta === boleta)) {
      setMessage({ text: 'Esa boleta ya está registrada.', type: 'error' });
      return;
    }

    setStudents(prev => [
      {
        id: `manual-${Date.now()}`,
        name,
        boleta,
        gender: studentForm.gender,
        career: studentForm.career,
        address,
      },
      ...prev,
    ]);
    setStudentForm({ name: '', boleta: '', career: '', address: '', gender: '' });
    setMessage({ text: 'Alumno registrado con éxito.', type: 'success' });
  };

  // Al seleccionar el archivo de Aspirantes se parsea en el navegador y su
  // resumen (nombre, boleta, sexo, carrera, domicilio) llena el apartado
  // Alumnos. Todo en memoria: no se guarda en ninguna base de datos.
  const handleAspirantesSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAspirantesFile(file);

    setIsSyncingAspirantes(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsedData = await parseExcelBuffer(buffer);
      const mapped = mapAspirantesToStudents(parsedData);
      setStudents(mapped);
      setMessage({ text: `Aspirantes cargados: ${mapped.length} alumnos. Ya se ven en el apartado Alumnos.`, type: 'success' });
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
      String(s.career || '').toLowerCase().includes(q) ||
      String(s.gender || '').toLowerCase().includes(q)
    );
  });

  const womenPct = clampPct(defaultWomenPct);

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="logo">SISTEMA GESTIÓN IPN</div>
        <div className="nav-links">
          <button onClick={() => setView('generator')} className={view === 'generator' ? 'active' : ''}>Generador Grupos</button>
          <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'active' : ''}>Alumnos</button>
          <button onClick={() => setView('register')} className={view === 'register' ? 'active' : ''}>Registro</button>
        </div>
      </nav>

      <main>
        {message.text && (
          <div className={`status-msg ${message.type}`}>
            <span>{message.text}</span>
            <button className="close-btn" onClick={() => setMessage({ text: '', type: '' })} aria-label="Cerrar">×</button>
          </div>
        )}

        {view === 'register' && (
          <div className="dashboard-container">
            <div className="login-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
              <h2>Registro de Nuevo Alumno</h2>
              <form onSubmit={handleStudentSubmit}>
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input type="text" value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Boleta</label>
                  <input type="text" value={studentForm.boleta} onChange={e => setStudentForm({ ...studentForm, boleta: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Sexo</label>
                  <select value={studentForm.gender} onChange={e => setStudentForm({ ...studentForm, gender: e.target.value })} required>
                    <option value="">Seleccione sexo</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Carrera</label>
                  <select value={studentForm.career} onChange={e => setStudentForm({ ...studentForm, career: e.target.value })} required>
                    <option value="">Seleccione carrera</option>
                    {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Dirección</label>
                  <textarea value={studentForm.address} onChange={e => setStudentForm({ ...studentForm, address: e.target.value })} required />
                </div>
                <button type="submit" className="btn-primary">Registrar</button>
              </form>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="dashboard-container">
            <h2>Listado de Alumnos</h2>
            <p className="muted" style={{ marginTop: '-0.5rem' }}>
              Los datos se llenan al subir el archivo de aspirantes en{' '}
              <strong>Generador Grupos</strong> y viven solo durante esta sesión:
              al recargar la página se empieza de cero.
            </p>

            <div style={{ margin: '1rem 0' }}>
              <input
                type="search"
                className="search-input"
                placeholder="Buscar por nombre, boleta, carrera o sexo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <span className="muted search-count" style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>
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
                      <td>{s.career}</td>
                      <td>{s.address}</td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan="5" className="faint" style={{ textAlign: 'center' }}>
                        {students.length === 0 ? 'Aún no hay alumnos. Sube el archivo de aspirantes en Generador Grupos.' : 'Sin resultados para la búsqueda'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'generator' && (
          <div className="dashboard-container generator">
            <header className="generator-head">
              <h2>Generador de Secuencias</h2>
              <p className="muted">Sigue los pasos para asignar los grupos a partir de tus archivos de Excel.</p>
            </header>

            {/* Paso 1 */}
            <section className={`step-card ${aspirantesFile ? 'is-done' : ''}`}>
              <div className="step-head">
                <span className="step-num">{aspirantesFile ? '✓' : '1'}</span>
                <div className="step-title">
                  <h3>Archivo de Aspirantes inscritos</h3>
                  <p className="muted">Al seleccionarlo se llena también el apartado Alumnos.</p>
                </div>
              </div>
              <div className="step-body">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  ref={fileGeneratorRef}
                  style={{ display: 'none' }}
                  onChange={handleAspirantesSelect}
                />
                <button className="btn-file" onClick={() => fileGeneratorRef.current?.click()} disabled={isSyncingAspirantes}>
                  {isSyncingAspirantes ? 'Cargando…' : 'Seleccionar archivo'}
                </button>
                <span className={`file-name ${aspirantesFile ? 'has-file' : ''}`}>
                  {aspirantesFile ? aspirantesFile.name : 'Ningún archivo seleccionado'}
                </span>
              </div>
            </section>

            {/* Paso 2 */}
            <section className={`step-card ${secuenciasFile ? 'is-done' : ''}`}>
              <div className="step-head">
                <span className="step-num">{secuenciasFile ? '✓' : '2'}</span>
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
                <button className="btn-file" onClick={() => fileSecuenciasRef.current?.click()}>Seleccionar archivo</button>
                <span className={`file-name ${secuenciasFile ? 'has-file' : ''}`}>
                  {secuenciasFile ? secuenciasFile.name : 'Ningún archivo seleccionado'}
                </span>
              </div>
            </section>

            {/* Paso 3 - Distribución por sexo (control visual) */}
            <section className="step-card">
              <div className="step-head">
                <span className="step-num">3</span>
                <div className="step-title">
                  <h3>Distribución por sexo en cada secuencia</h3>
                  <p className="muted">Ajusta el balance de mujeres y hombres. Se aplica a todas las secuencias.</p>
                </div>
              </div>
              <div className="step-body">
                <div className="ratio-control">
                  <div className="ratio-legend">
                    <span className="ratio-tag women">♀ Mujeres <strong>{womenPct}%</strong></span>
                    <span className="ratio-tag men"><strong>{100 - womenPct}%</strong> Hombres ♂</span>
                  </div>

                  <input
                    type="range" min="0" max="100" step="1"
                    className="ratio-slider"
                    value={womenPct}
                    onChange={e => setDefaultWomenPct(clampPct(e.target.value))}
                    aria-label="Porcentaje de mujeres"
                  />

                  <div className="ratio-bar" role="img" aria-label={`${womenPct}% mujeres, ${100 - womenPct}% hombres`}>
                    <div className="ratio-bar-women" style={{ width: `${womenPct}%` }}>
                      {womenPct >= 12 && <span>{womenPct}%</span>}
                    </div>
                    <div className="ratio-bar-men" style={{ width: `${100 - womenPct}%` }}>
                      {100 - womenPct >= 12 && <span>{100 - womenPct}%</span>}
                    </div>
                  </div>

                  <div className="ratio-exact">
                    <label>
                      Ajuste exacto de mujeres:
                      <input
                        type="number" min="0" max="100"
                        value={womenPct}
                        onChange={e => setDefaultWomenPct(clampPct(e.target.value))}
                      /> %
                    </label>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>(predeterminado 50% / 50%)</span>
                  </div>
                </div>

                {secuenciasList.length > 0 && (
                  <details className="pct-editor">
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
                            const pct = womenPctBySeq[s.secuencia] ?? womenPct;
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
                        Restablecer todos al {womenPct}%
                      </button>
                    )}
                  </details>
                )}
              </div>
            </section>

            {/* Paso 4 - Placeholder API de kilómetros */}
            <section className="step-card step-card--soon">
              <div className="step-head">
                <span className="step-num">4</span>
                <div className="step-title">
                  <h3>Distancia y preferencia de turno <span className="soon-badge">Próximamente</span></h3>
                  <p className="muted">
                    Aquí se conectará la API que calcula los kilómetros del domicilio de cada aspirante:
                    entre más lejos viva, mayor preferencia tendrá para el turno matutino.
                  </p>
                </div>
              </div>
            </section>

            <button
              className="btn-generate"
              onClick={handleGenerateExcel}
              disabled={isGenerating || !aspirantesFile || !secuenciasFile}
            >
              {isGenerating ? 'Generando…' : 'Procesar y Descargar'}
            </button>
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
