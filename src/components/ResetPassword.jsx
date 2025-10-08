import React, { useState, useEffect } from 'react';
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
      // 1. Obtener el usuario actual con email
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) throw new Error('No se encontró el usuario');

      // 2. Actualizar contraseña en Auth de Supabase
      const { error: authError } = await supabase.auth.updateUser({
        password: password
      });

      if (authError) throw authError;

      // 3. Actualizar contraseña en tu tabla 'usuarios' usando el email
      const { error: dbError } = await supabase
        .from('usuarios')
        .update({ 
          password: password,
          updated_at: new Date().toISOString(),
          ultima_actualizacion: new Date().toISOString()
        })
        .eq('email', user.email); // Usando email como referencia

      if (dbError) {
        console.error('Error actualizando tabla usuarios:', dbError);
        setMessage('Contraseña actualizada en auth, pero error en tabla usuarios');
      } else {
        setMessage('¡Contraseña actualizada correctamente en todo el sistema!');
      }

      setTimeout(() => navigate('/login'), 2000);

    } catch (error) {
      console.error('Error completo:', error);
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