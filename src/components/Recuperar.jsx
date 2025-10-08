import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Login.css';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaEnvelope } from 'react-icons/fa';

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
      <div className="login-box">
        <div className="header-line">
          <button className="back-button" onClick={() => navigate('/login')}>
            <FaArrowLeft />
          </button>
          <h2>Recuperar contraseña</h2>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Correo electrónico</label>
          <div className="input-icon">
            <FaEnvelope className="input-icon-symbol" />
            <input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit">Enviar enlace</button>
        </form>

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
};

export default Recuperar;
