import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/IniciarSesion.css';
import { useNavigate } from 'react-router-dom';
import fondoInicio from '../assets/fondoInicio.png'; 

const IniciarSesion = () => { // COD007
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => { // MCOD007-1
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => { // MCOD007-2
    e.preventDefault();
    const { email, password } = formData;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  return (
    <div className="login-container" style={{
        backgroundImage: `url(${fondoInicio})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
      }}>
      <div className="logo">FamBudget</div>
      <div className="login-box">
        <h2>¡Hola, Bienvenido!</h2>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>Correo electrónico</label>
        <input
          type="email"
          name="email"
          placeholder="tu@email.com"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <label>Contraseña</label>
        <input
          type="password"
          name="password"
          placeholder="••••••••"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <button type="submit">Ingresar</button>
      </form>

      <div className="bottom-text">
        ¿No tienes una cuenta? <span onClick={() => navigate('/register')}>Regístrate</span>
        <br />
        <a href="/send-email" className="forgot-password">¿Olvidó su contraseña?</a>
      </div>
      </div>
      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default IniciarSesion;
