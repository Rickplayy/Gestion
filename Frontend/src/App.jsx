import { useState, useEffect, useRef } from 'react';
import { parseExcelBuffer } from './utils/excelParser';
import {
  generateGroupsFromBuffer,
  exportToExcel,
  extractSecuencias,
  pickSaveTarget,
  discardSaveTarget,
  normalizeCareer,
} from './utils/groupGenerator';
import './App.css';

// Convierte los registros crudos del Excel de aspirantes a filas de alumnos
// (nombre, boleta, sexo, carrera, dirección). Deduplica por boleta. Se usa
// solo para contar cuántos aspirantes únicos trae el archivo cargado.
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
  const [message, setMessage] = useState({ text: '', type: '' });

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

  // Al seleccionar el archivo de Aspirantes se parsea en el navegador para
  // validar que se lee bien y mostrar cuántos aspirantes únicos trae. Todo en
  // memoria: no se guarda en ninguna base de datos.
  const handleAspirantesSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAspirantesFile(file);

    setIsSyncingAspirantes(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsedData = await parseExcelBuffer(buffer);
      const mapped = mapAspirantesToStudents(parsedData);
      setMessage({ text: `Aspirantes cargados: ${mapped.length} alumnos.`, type: 'success' });
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

    // "Guardar como" se abre PRIMERO, dentro del click y antes de procesar:
    // tanto el diálogo como la apertura del stream de escritura dependen de la
    // activación del usuario, que expira mientras se reparten los grupos.
    const target = await pickSaveTarget('gruposAsignados.xlsx');
    if (target?.cancelled) {
      setMessage({ text: 'Guardado cancelado.', type: 'error' });
      return;
    }

    setIsGenerating(true);
    setMessage({ text: 'Procesando archivos y generando secuencias...', type: 'success' });

    try {
      const aspirantesBuffer = await aspirantesFile.arrayBuffer();
      // secuenciasList ya fue parseada al seleccionar el archivo (paso 2): se
      // reutiliza en vez de releer y re-parsear el mismo Excel de secuencias.
      const generatedData = await generateGroupsFromBuffer(aspirantesBuffer, secuenciasList, {
        defaultWomenPct: clampPct(defaultWomenPct),
        womenPctBySeq,
      });
      const saved = await exportToExcel(generatedData, 'gruposAsignados.xlsx', target);
      setMessage({
        text: saved.location === 'descargas'
          ? `"${saved.name}" se descargó a tu carpeta de Descargas con ${generatedData.length} alumnos asignados.`
          : `"${saved.name}" guardado con ${generatedData.length} alumnos asignados.`,
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      // El diálogo ya había creado el archivo vacío: se descarta en vez de
      // dejar un .xlsx de 0 bytes que Excel reporta como dañado.
      await discardSaveTarget(target);
      setMessage({ text: 'Error generando el archivo: ' + err.message, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const womenPct = clampPct(defaultWomenPct);

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="brand">
          <div className="logo">SISTEMA GESTIÓN IPN</div>
          <div className="app-title">Generador Grupos</div>
        </div>
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

          {/* Paso 1 */}
          <section className={`step-card ${aspirantesFile ? 'is-done' : ''}`}>
            <div className="step-head">
              <span className="step-num">{aspirantesFile ? '✓' : '1'}</span>
              <div className="step-title">
                <h3>Archivo de Aspirantes inscritos</h3>
                <p className="muted">Se usará para asignar a los alumnos a sus grupos.</p>
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

          <button
            className="btn-generate"
            onClick={handleGenerateExcel}
            disabled={isGenerating || !aspirantesFile || !secuenciasFile}
          >
            {isGenerating ? 'Generando…' : 'Procesar y Descargar'}
          </button>
        </div>
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
