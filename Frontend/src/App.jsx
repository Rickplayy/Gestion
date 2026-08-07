import { useState, useEffect } from 'react';
import { api, getToken, setToken } from './api/client';
import GeneratorWizard from './views/GeneratorWizard';
import CiclosView from './views/CiclosView';
import CarrerasView from './views/CarrerasView';
import GruposView from './views/GruposView';
import AlumnosView from './views/AlumnosView';
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
        <div className="brand-mark">IPN</div>
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

  // view: 'ciclos' | 'wizard' | 'carreras' | 'grupos' | 'alumnos'
  const [view, setView] = useState('ciclos');
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [selectedCarrera, setSelectedCarrera] = useState(null);
  const [selectedGrupo, setSelectedGrupo] = useState(null);

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
    setView('ciclos');
    setSelectedTerm(null);
    setSelectedCarrera(null);
    setSelectedGrupo(null);
  };

  if (!authed) {
    return <LoginForm onLoggedIn={() => setAuthed(true)} />;
  }

  const goToCiclos = () => {
    setView('ciclos');
    setSelectedTerm(null);
    setSelectedCarrera(null);
    setSelectedGrupo(null);
  };

  const goToCarreras = () => {
    setView('carreras');
    setSelectedCarrera(null);
    setSelectedGrupo(null);
  };

  const goToGrupos = () => {
    setView('grupos');
    setSelectedGrupo(null);
  };

  const selectCiclo = (term) => {
    setSelectedTerm(term);
    setView('carreras');
  };

  const selectCarrera = (carrera) => {
    setSelectedCarrera(carrera);
    setView('grupos');
  };

  const selectGrupo = (grupo) => {
    setSelectedGrupo(grupo);
    setView('alumnos');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">IPN</div>
          <div className="brand-text">
            <div className="brand-title">Sistema Gestión IPN</div>
            <div className="brand-subtitle">Gestión de ciclos escolares</div>
          </div>
        </div>
        <button className="btn-outline" onClick={handleLogout}>Salir</button>
      </header>

      <nav className="breadcrumb">
        {view === 'ciclos' ? (
          <span className="breadcrumb-current">Ciclos</span>
        ) : (
          <button className="breadcrumb-item" onClick={goToCiclos}>Ciclos</button>
        )}

        {view === 'wizard' && (
          <>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Nuevo ciclo escolar</span>
          </>
        )}

        {selectedTerm && (view === 'carreras' || view === 'grupos' || view === 'alumnos') && (
          <>
            <span className="breadcrumb-sep">/</span>
            {view === 'carreras' ? (
              <span className="breadcrumb-current">{selectedTerm.descripcion}</span>
            ) : (
              <button className="breadcrumb-item" onClick={goToCarreras}>{selectedTerm.descripcion}</button>
            )}
          </>
        )}

        {selectedCarrera && (view === 'grupos' || view === 'alumnos') && (
          <>
            <span className="breadcrumb-sep">/</span>
            {view === 'grupos' ? (
              <span className="breadcrumb-current">{selectedCarrera.descripcion}</span>
            ) : (
              <button className="breadcrumb-item" onClick={goToGrupos}>{selectedCarrera.descripcion}</button>
            )}
          </>
        )}

        {selectedGrupo && view === 'alumnos' && (
          <>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{selectedGrupo.secuencia}</span>
          </>
        )}
      </nav>

      {message.text && (
        <div className={`status-msg ${message.type}`}>
          <span>{message.text}</span>
          <button className="close-btn" onClick={() => setMessage({ text: '', type: '' })} aria-label="Cerrar">×</button>
        </div>
      )}

      <main>
        {view === 'ciclos' && (
          <CiclosView onSelectCiclo={selectCiclo} onCreateNew={() => setView('wizard')} onMessage={setMessage} />
        )}
        {view === 'wizard' && (
          <GeneratorWizard carreras={carreras} onMessage={setMessage} onBack={goToCiclos} />
        )}
        {view === 'carreras' && selectedTerm && (
          <CarrerasView key={selectedTerm.id} term={selectedTerm} onSelectCarrera={selectCarrera} onBack={goToCiclos} onMessage={setMessage} />
        )}
        {view === 'grupos' && selectedTerm && selectedCarrera && (
          <GruposView key={selectedCarrera.id} term={selectedTerm} carrera={selectedCarrera} onSelectGrupo={selectGrupo} onBack={goToCarreras} onMessage={setMessage} />
        )}
        {view === 'alumnos' && selectedTerm && selectedCarrera && selectedGrupo && (
          <AlumnosView key={selectedGrupo.id} term={selectedTerm} carrera={selectedCarrera} grupo={selectedGrupo} onBack={goToGrupos} onMessage={setMessage} />
        )}
      </main>
    </div>
  );
}

export default App;
