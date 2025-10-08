import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Login.css';
import { useNavigate } from 'react-router-dom';

const Recuperar = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5173/reset-password', // 👈 cambia esta URL según tu app
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Se envió un enlace de recuperación a tu correo');
    }
  };

  return (
    <div className="login-container">
      <h2>Recuperar contraseña</h2>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>Correo electrónico</label>
        <input
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button type="submit">Enviar enlace</button>
      </form>

      {message && <p className="message">{message}</p>}

      <button className="link-button" onClick={() => navigate('/login')}>
        Volver al login
      </button>
    </div>
  );
};

export default Recuperar;
