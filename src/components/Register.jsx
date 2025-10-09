import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Register.css';
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate } from 'react-router-dom';
import fondoInicio from '../assets/fondoInicio.png'; 

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
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

    const { email, password, confirmPassword, fullName, isAdmin } = formData;
    
    if (password !== confirmPassword) {
      return setMessage('Las contraseñas no coinciden.');
    }

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
        rol,
        auth_id : userId
      }
    ]);

    if (dbError) {
      console.error(dbError);
      return setMessage(`Error al guardar en la base de datos: ${dbError.message}`);
    }

    setMessage(`Registro exitoso como ${rol}. Revisa tu correo para confirmar.`);
    setFormData({ email: '', password: '', confirmPassword : '', fullName: '', isAdmin: false });
  };

  return (
    <div className="register-container"style={{
        backgroundImage: `url(${fondoInicio})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
      }}>
      <div className="logo">FamBudget</div>
      <div className="register-box">
      <div className='header-container'>
        <button className="back-button" onClick={() => navigate("/login")}>
          <FaArrowLeft />
        </button>
        <h2>Crear cuenta</h2>
      </div>
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
        <label>Confirmar Contraseña</label>
          <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />

        <div className="checkbox">
          <input
            type="checkbox"
            name="isAdmin"
            checked={formData.isAdmin}
            onChange={handleChange}
          />
          <span>¿Registrar como administrador?</span>
        </div>

        <button type="submit">Crear Cuenta</button>
      </form>

      {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
};

export default Register;
