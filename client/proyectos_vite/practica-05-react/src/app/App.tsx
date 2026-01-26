import {useMemo, useState} from 'react';
import './App.css';
import { getSession, login, logout } from './auth'; 
//Este archivo define el componente principal de la aplicación


export default function login() {
 /* const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const canSubmit = useMemo(() => {
    if(!email.trim() || !password.trim() || password.length <6) return false;
    return true;
  }, [email, password]); 
  */
  const session = getSession();

 if(!session) {
  function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    alert(`Login simulado existoso con email: ${session.email}`);
    console.log("Email logeado:", session.email);
  }
  return (
    <main className ="page">
      <section className='card'>
        <h1>Iniciar Sesión</h1>
        <p className='subtitulo'>Por favor ingrese sus datos </p>
        <form className='form' onSubmit={manejarEnvio}>
          <label className='field'> 
          <span className='label'> Correo </span>
          <input 
          className='input'
          type='email'
          placeholder='docente@universidad.edu'
          value={email}
          onChange={(e) => setEmail (e.target.value)}
          />
          </label>
          <label className='field'>
          <span className='label'> Contraseña </span>
          <input
          className='input'
          type='password'
          placeholder='Minimo 6 caracteres'
          value={session.password}
          onChange={(e) => setPassword (e.target.value)}
          />
          </label>

          <button className='button' type='submit' disabled={!canSubmit}>
            Iniciar Sesión
          </button>
          <p className='hint'> Regla: correo valido + contraseña 6 caracteres </p>
                  </form>
      </section>
    </main>
);

  
 }else{
  export default function App() {
   const session = getSession();
    if (session) {
    return (
      <main className ="page">
        <section className='card'>
          <h1>Sesion Activa</h1>
          <p className='subtitulo'>Ventana de sesion </p>
          <p style={{marginTop: '14px'}}> 
            <strong>Usuario:</strong> {session.email} <br />
          </p>
          <p style={{marginTop: '14px'}}> 
            <strong>Creado en:</strong> {new Date(session.CreadoEn).toLocaleString()} <br />
          </p>
            <button className='button' type='button' style={{marginTop: '14px', opacity: 0.75}} onClick={() => {
              logout();
              window.location.reload();
            }}>
              Cerrar Sesion
            </button>
            
        </section>
      </main>
  );}
  }
  

 }

  
