import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './Login.css';

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
      // Solo actualizar contraseña en Supabase Auth
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
      <h2>Establecer nueva contraseña</h2>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>Nueva contraseña</label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        <label>Confirmar contraseña</label>
        <input
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>
      </form>

      {message && <p className="message">{message}</p>}

      <button className="link-button" onClick={() => navigate('/login')}>
        Volver al login
      </button>
    </div>
  );
};

export default ResetPassword;