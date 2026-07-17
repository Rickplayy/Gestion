import { useState, useEffect, useRef } from 'react';
import { parseExcelBuffer } from './utils/excelParser';
import { generateGroupsFromBuffer, exportToExcel } from './utils/groupGenerator';
import './App.css';

function App() {
  const [view, setView] = useState('register'); // 'register', 'login', 'dashboard'
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [careers, setCareers] = useState([]);
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Form States
  const [studentForm, setStudentForm] = useState({ name: '', boleta: '', careerId: '', address: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const fileInputRef = useRef(null);
  const fileGeneratorRef = useRef(null);
  const fileLugaresRef = useRef(null);
  const [aspirantesFile, setAspirantesFile] = useState(null);
  const [lugaresFile, setLugaresFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm)
      });
      if (res.ok) {
        setMessage({ text: 'Alumno registrado con éxito', type: 'success' });
        setStudentForm({ name: '', boleta: '', careerId: '', address: '' });
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
    setView('register');
    setMessage({ text: 'Sesión cerrada', type: 'success' });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
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
        setMessage({ text: data.message, type: 'success' });
        fetchStudents(); // Refresh list
      } else {
        setMessage({ text: data.error || 'Error al importar excel', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error procesando el archivo: ' + err.message, type: 'error' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerateExcel = async () => {
    if (!aspirantesFile || !lugaresFile) {
      setMessage({ text: 'Por favor selecciona ambos archivos.', type: 'error' });
      return;
    }

    setIsGenerating(true);
    setMessage({ text: 'Procesando archivo y generando secuencias...', type: 'success' });
    try {
      const aspirantesBuffer = await aspirantesFile.arrayBuffer();
      const lugaresBuffer = await lugaresFile.arrayBuffer();
      const generatedData = await generateGroupsFromBuffer(aspirantesBuffer, lugaresBuffer);
      await exportToExcel(generatedData);
      setMessage({ text: 'Archivo guardado exitosamente.', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error generando el archivo: ' + err.message, type: 'error' });
    } finally {
      setIsGenerating(false);
      setAspirantesFile(null);
      setLugaresFile(null);
      if (fileGeneratorRef.current) fileGeneratorRef.current.value = '';
      if (fileLugaresRef.current) fileLugaresRef.current.value = '';
    }
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="logo">SISTEMA GESTIÓN IPN</div>
        <div className="nav-links">
          <button onClick={() => setView('register')} className={view === 'register' ? 'active' : ''}>Registro</button>
          {!isLoggedIn ? (
            <button onClick={() => setView('login')} className={view === 'login' ? 'active' : ''}>Admin Login</button>
          ) : (
            <>
              <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'active' : ''}>Alumnos</button>
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
            <button style={{float:'right', background:'none', border:'none', cursor:'pointer'}} onClick={() => setMessage({text:'', type:''})}>X</button>
          </div>
        )}

        {view === 'register' && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Listado de Alumnos Registrados</h2>
              <div>
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload} 
                />
                <button 
                  className="btn-primary" 
                  style={{ marginTop: 0 }} 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Procesando...' : 'Importar Excel'}
                </button>
              </div>
            </div>
            <table className="students-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Boleta</th>
                  <th>Carrera</th>
                  <th>Dirección</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.boleta}</td>
                    <td>{s.Career?.name}</td>
                    <td>{s.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'generator' && isLoggedIn && (
          <div className="dashboard-container">
            <div className="login-card" style={{maxWidth: '600px', margin: '0 auto', textAlign: 'center'}}>
              <h2>Generador de Secuencias</h2>
              <p>Sube el archivo de Aspirantes y el archivo de Lugares para asignar grupos.</p>
              
              <div style={{ marginTop: '1rem', textAlign: 'left', background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <strong>1. Archivo de Aspirantes Inscritos:</strong><br/>
                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    ref={fileGeneratorRef} 
                    style={{ display: 'none' }} 
                    onChange={e => setAspirantesFile(e.target.files[0])} 
                  />
                  <button className="btn-primary" onClick={() => fileGeneratorRef.current?.click()} style={{ width: 'auto', padding: '0.5rem 1rem', marginTop: '0.5rem' }}>Seleccionar</button>
                  <span style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>{aspirantesFile ? aspirantesFile.name : 'Ningún archivo seleccionado'}</span>
                </div>
                
                <div>
                  <strong>2. Archivo de Lugares (Capacidades):</strong><br/>
                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    ref={fileLugaresRef} 
                    style={{ display: 'none' }} 
                    onChange={e => setLugaresFile(e.target.files[0])} 
                  />
                  <button className="btn-primary" onClick={() => fileLugaresRef.current?.click()} style={{ width: 'auto', padding: '0.5rem 1rem', marginTop: '0.5rem' }}>Seleccionar</button>
                  <span style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>{lugaresFile ? lugaresFile.name : 'Ningún archivo seleccionado'}</span>
                </div>
              </div>
              
              <button 
                  className="btn-primary" 
                  onClick={handleGenerateExcel}
                  disabled={isGenerating || !aspirantesFile || !lugaresFile}
                  style={{ padding: '1rem', fontSize: '1.2rem', marginTop: '2rem' }}
                >
                  {isGenerating ? 'Generando...' : 'Procesar y Descargar'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
