import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Login.css';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { email, password } = formData;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Inicio de sesión exitoso');
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  return (
    <div className="login-container">
      <h2>Iniciar sesión</h2>
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

      {message && <p className="message">{message}</p>}

      <p className="register-text">
        ¿No tienes cuenta?
        <button className="link-button" onClick={() => navigate('/register')}>
          Regístrate
        </button>
      </p>
    </div>
  );
};

export default Login;