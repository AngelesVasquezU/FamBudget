import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import '../../styles/IniciarSesion.css';
import { useNavigate } from 'react-router-dom';
import fondo from '../../assets/fondo.png';
import Input from "../../components/input/Input";
import Button from "../../components/button/Button";
import Message from "../../components/message/Message";

const IniciarSesion = () => { // VIEW-001
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // MVIEW001-1
  // Maneja el cambio en los campos del formulario.
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // MVIEW001-2
  // Maneja el envío del formulario de inicio de sesión.
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password } = formData;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({ text: "Credenciales Inválidas", type: "error" });
      setTimeout(() => setMessage(null), 3000);

    } else {
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  return (
    <div className="login-container" style={{
      backgroundImage: `url(${fondo})`,
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
          <Input
            label="Correo electrónico"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="tu@gmail.com"
            required
          />

          <Input
            label="Contraseña"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
          />

          <Button type="submit">Ingresar</Button>
        </form>

        <div className="bottom-text">
          ¿No tienes una cuenta? <span onClick={() => navigate('/register')}>Regístrate</span>
          <br />
          <a href="/send-email" className="forgot-password">¿Olvidó su contraseña?</a>
        </div>
      </div>
      {message && <Message type={message.type}>{message.text}</Message>}
    </div>
  );
};

export default IniciarSesion;
