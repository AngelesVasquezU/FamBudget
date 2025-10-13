import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/Registro.css';
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate } from 'react-router-dom';
import fondoInicio from '../assets/fondoInicio.png'; 

const Registro = () => { // COD008
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    isAdmin: false
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => { // MCOD008-1
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => { // MCOD008-2
    e.preventDefault();
    setMessage('');

    const { email, password, confirmPassword, fullName, isAdmin } = formData;

    if (password !== confirmPassword) {
      return setMessage("Las contraseñas no coinciden.");
    }

    const rol = isAdmin ? 'administrador' : 'miembro familiar';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          fullName: fullName,
          role: rol
        }
      }
    });

    if (error) {
      return setMessage(`Error al registrar usuario: ${error.message}`);
    }

    setMessage(`Registro exitoso como ${rol}. Revisa tu correo para confirmar tu cuenta.`);
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      isAdmin: false
    });
  };

  return (
    <div className="register-container"
      style={{
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
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
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

          <button type="submit">Crear Cuenta</button>
        </form>

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
};

export default Registro;