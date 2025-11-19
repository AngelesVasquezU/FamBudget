import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import '../../styles/Registro.css';
import fondo from '../../assets/fondo.png';
import BackButton from '../../components/button/BackButton';
import Input from '../../components/input/Input';
import Button from '../../components/button/Button';

const Registro = () => { // COD008
  const [formData, setFormData] = useState({
    email: '',
    parentesco: '',
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

    const { email, parentesco, password, confirmPassword, fullName, isAdmin } = formData;

    if (password !== confirmPassword) {
      return setMessage("Las contraseñas no coinciden.");
    }

    const rol = isAdmin ? 'Administrador' : 'Miembro familiar';

    try {
      // 1. Registrar usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: rol
          }
        }
      });

      if (authError) {
        return setMessage(`Error al registrar usuario: ${authError.message}`);
      }

      // 2. Crear o actualizar registro en la tabla usuarios
      if (authData.user) {
        console.log("Creando o actualizando registro en tabla usuarios...");
        
        const { error: dbError } = await supabase
          .from('usuarios')
          .upsert(
            {
              auth_id: authData.user.id,
              nombre: fullName,
              correo: email,
              rol: rol,
              parentesco: parentesco || null,
              saldo_disponible: 0
            },
            { onConflict: 'auth_id' }
          );

        if (dbError) {
          console.error('Error al upsert en usuarios:', dbError);
          return setMessage(`Error al crear/actualizar el perfil: ${dbError.message}`);
        }
        
        console.log("Registro en usuarios creado o actualizado exitosamente");
      }

      setMessage(`Registro exitoso como ${rol}. Revisa tu correo para confirmar tu cuenta.`);
      setFormData({
        email: '',
        parentesco: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        isAdmin: false
      });

    } catch (error) {
      console.error('Error general:', error);
      setMessage(`Error inesperado: ${error.message}`);
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