import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import { FaLock, FaCheckCircle } from 'react-icons/fa';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setMessage('¡Contraseña actualizada correctamente!');
      setTimeout(() => navigate('/login'), 2000);

    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
      <h2>Restablecer contraseña</h2>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>Nueva contraseña</label>
        <div className="input-icon">
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <FaLock className="input-icon-symbol" />
        </div>

        <label>Confirmar contraseña</label>
        <div className="input-icon">
          <input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <FaCheckCircle className="input-icon-symbol" />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>
      </form>

      {message && <p className="message">{message}</p>}

      <button className="link-button" onClick={() => navigate('/login')}>
        Volver al login
      </button>

      </div>
    </div>
  );
};

export default ResetPassword;