import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import '../../styles/IniciarSesion.css';
import { FaEnvelope } from 'react-icons/fa';
import BackButton from "../../components/button/BackButton";
import Input from "../../components/input/Input";
import Button from "../../components/button/Button";

const SendEmail = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5173/reset-password',
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
          <BackButton to="/login" />
          <h2>Recuperar contraseña</h2>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <Input
            label="Correo Electrónico"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
          />

          <Button type="submit">Enviar enlace</Button>
        </form>

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
};

export default SendEmail;
