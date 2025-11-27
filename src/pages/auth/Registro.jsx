import { useState } from 'react';
import { providers } from '../../services/providers';
import '../../styles/Registro.css';
import fondo from '../../assets/fondo.png';
import BackButton from '../../components/button/BackButton';
import Input from '../../components/input/Input';
import Button from '../../components/button/Button';

const { gestorAuth } = providers;
  
const Registro = () => { // VIEW-002
  const [formData, setFormData] = useState({
    email: '',
    parentesco: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    isAdmin: false
  });
  const [message, setMessage] = useState('');

  // MVIEW002-1
  // Maneja el cambio en los campos del formulario.
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // MVIEW002-2
  // Maneja el envío del formulario de registro.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    const { email, parentesco, password, confirmPassword, fullName, isAdmin } = formData;

    if (password !== confirmPassword) {
      return setMessage("Las contraseñas no coinciden.");
    }

    const rol = isAdmin ? 'Administrador' : 'Miembro familiar';

    try {
      await gestorAuth.register({
        email,
        password,
        fullName,
        parentesco: parentesco?.trim() || null,
        role: rol
      });

      await gestorAuth.logout();

      setMessage(`Registro exitoso como ${rol}`);
      setFormData({
        email: '',
        parentesco: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        isAdmin: false
      });

    } catch (error) {
      console.error("Error al registrar usuario:", error);
      setMessage(`Error al registrar usuario: ${error.message}`);
    }
  };

  return (
    <div className="register-container"
      style={{
        backgroundImage: `url(${fondo})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
      }}>

      <div className="logo">FamBudget</div>
      <div className="register-box">
        <div className='header-container'>
          <BackButton to="/login" />
          <h2>Crear cuenta</h2>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <Input
            label="Nombre Completo"
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
          />
          <Input
            label="Parentesco (opcional)"
            type="text"
            name="parentesco"
            value={formData.parentesco}
            onChange={handleChange}
          />
          <Input
            label="Correo electrónico"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <Input
            label="Contraseña"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <Input
            label="Confirmar Contraseña"
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

          <Button type="submit">Crear Cuenta</Button>
        </form>

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
};

export default Registro;