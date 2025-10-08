import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Register.css';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    isAdmin: false
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    const { email, password, fullName, isAdmin } = formData;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) {
      return setMessage(`Error al registrar usuario: ${authError.message}`);
    }

    const userId = authData.user?.id;
    const rol = isAdmin ? 'administrador' : 'miembro familiar';

    const { error: dbError } = await supabase.from('usuarios').insert([
      {
        nombre: fullName,
        correo: email,
        password,
        rol,
      }
    ]);

    if (dbError) {
      console.error(dbError);
      return setMessage(`Error al guardar en la base de datos: ${dbError.message}`);
    }

    setMessage(`Registro exitoso como ${rol}. Revisa tu correo para confirmar.`);
    setFormData({ email: '', password: '', fullName: '', isAdmin: false });
  };

  return (
    <div className="register-container">
      <h2>Crear cuenta</h2>
      <form className="register-form" onSubmit={handleSubmit}>
        <label>Nombre completo</label>
        <input
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          required
        />

        <label>Correo electrónico</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <label>Contraseña</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <div className="checkbox">
          <input
            type="checkbox"
            name="isAdmin"
            checked={formData.isAdmin}
            onChange={handleChange}
          />
          <span>¿Registrar como administrador?</span>
        </div>

        <button type="submit">Registrarse</button>
      </form>

      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default Register;
