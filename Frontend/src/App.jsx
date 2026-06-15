import { useState, useEffect } from 'react';
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

  const API_URL = 'http://localhost:3001/api';

  useEffect(() => {
    fetch(`${API_URL}/careers`)
      .then(res => res.json())
      .then(data => setCareers(data))
      .catch(err => console.error(err));
      
    if (isLoggedIn && view === 'dashboard') {
      fetchStudents();
    }
  }, [isLoggedIn, view]);

  const fetchStudents = () => {
    fetch(`${API_URL}/students`)
      .then(res => res.json())
      .then(data => setStudents(data))
      .catch(err => console.error(err));
  };

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
    } catch (err) {
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
    } catch (err) {
      setMessage({ text: 'Error al iniciar sesión', type: 'error' });
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setView('register');
    setMessage({ text: 'Sesión cerrada', type: 'success' });
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
            <h2>Listado de Alumnos Registrados</h2>
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
      </main>
    </div>
  );
}

export default App;
