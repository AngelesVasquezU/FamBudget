import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { GestorFamilia } from './managers/GestorFamilia';
import { GestorUsuario } from './managers/GestorUsuario';
import { Home, PlusCircle, Edit, Trash2, Users, X } from 'lucide-react';
import { FaUsers } from "react-icons/fa";
import '../styles/Familia.css';

const Familia = () => {
    const gestorUsuario = new GestorUsuario(supabase);
    const gestorFamilia = new GestorFamilia(supabase, gestorUsuario);

    const [mostrarModal, setMostrarModal] = useState(false);
    const [nuevoMiembro, setNuevoMiembro] = useState({ email: '', parentesco: '' });

    const [miFamilia, setMiFamilia] = useState(null);
    const [miembros, setMiembros] = useState([]);
    const [rolUsuario, setRolUsuario] = useState('');

    const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
    const [miembroSeleccionado, setMiembroSeleccionado] = useState(null);
    const [mensajeExito, setMensajeExito] = useState('');

    const fetchMiFamilia = async () => {
        try {
            const familia = await gestorFamilia.obtenerMiFamilia();
            setMiFamilia(familia);

            const usuario = await gestorUsuario.obtenerUsuario();
            setRolUsuario(usuario.rol);

            if (familia) {
                const miembros = await gestorFamilia.obtenerMiembros(familia.id);
                setMiembros(miembros || []);
            }
        } catch (error) {
            console.error('Error obteniendo mi familia:', error);
        }
    };

    const handleAgregarMiembro = async () => {
        if (!nuevoMiembro.email.trim()) {
            return alert('Completa todos los campos');
        }

        try {
            await gestorFamilia.agregarMiembro(miFamilia.id, nuevoMiembro.email.trim(), nuevoMiembro.parentesco.trim());
            setNuevoMiembro({ email: '', parentesco: '' });
            setMostrarModal(false);
            fetchMiFamilia();
            alert('Miembro agregado correctamente');
        } catch (error) {
            alert(error.message);
        }
    };

    const handleEliminarMiembro = async (miembro) => {
        if (!window.confirm(`¿Seguro que deseas eliminar a ${miembro.nombre || miembro.email}?`)) return;
        try {
            await gestorFamilia.eliminarMiembro(miembro.id);
            fetchMiFamilia();
            alert('Miembro eliminado del grupo');
        } catch (error) {
            alert(error.message);
        }
    };
    useEffect(() => {
        fetchMiFamilia();
    }, []);

    if (!miFamilia) {
        return (
            <div className="familia-container">
                <h2>Grupo Familiar</h2>
                <p>No perteneces a ninguna familia actualmente.</p>
            </div>
        );
    }

    const esAdmin = rolUsuario === 'Administrador';

    return (
        <div className="familia-container">
            <h2>{esAdmin ? 'Gestionar Grupo Familiar' : 'Mi Grupo Familiar'}</h2>
            <div className="familia-header">
                <div className="familia-info">
                    <Home size={32} className="icono-familia" />
                    <div>
                        <h2>{miFamilia.nombre}</h2>
                        <p className="familia-nombre">
                            <FaUsers size={17} /> {miembros.length} {miembros.length > 1 ? 'miembros' : 'miembro'}
                        </p>
                    </div>
                </div>
                {esAdmin && (
                    <button className="btn-agregar" onClick={() => setMostrarModal(true)}>
                        <PlusCircle size={18} /> Agregar Miembro
                    </button>
                )}

            </div>

            <div className="tabla-miembros">
                <h3>Miembros del Grupo</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Miembro</th>
                            <th>Correo</th>
                            <th>Rol</th>
                            {esAdmin && <th>Acciones</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {miembros.map((m) => (
                            <tr key={m.id}>
                                <td style={{ verticalAlign: 'middle', padding: '8px 12px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#222' }}>
                                            {m.nombre}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: '#777', marginTop: '2px' }}>
                                            {m.parentesco}
                                        </span>
                                    </div>
                                </td>
                                <td>{m.correo}</td>
                                <td>{m.rol}</td>
                                {esAdmin && (
                                    <td className="acciones">
                                        {m.rol !== 'Administrador' && (
                                            <button
                                                className="btn-icono editar"
                                                onClick={() => {
                                                    setMiembroSeleccionado(m);
                                                    setMostrarConfirmacion(true);
                                                }}
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}
                                        {m.rol !== 'Administrador' && (
                                            <button className="btn-icono eliminar" onClick={() => handleEliminarMiembro(m)}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {mostrarModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Agregar nuevo miembro</h3>
                            <button className="btn-cerrar" onClick={() => { setMostrarModal(false); }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">

                            <label>Correo electrónico</label>
                            <input
                                type="email"
                                placeholder="ejemplo@correo.com"
                                value={nuevoMiembro.email}
                                onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, email: e.target.value })}
                            />
                            <button className="btn-guardar" onClick={handleAgregarMiembro}>
                                Guardar
                            </button>

                        </div>
                    </div>
                </div>
            )}

            {mostrarConfirmacion && (
                <div className="modal-overlay">
                    <div className="modal modal-confirmacion">
                        <h3>¿Transferir rol de administrador?</h3>
                        <p>
                            Vas a pasar el rol de <strong>Administrador</strong> a{' '}
                            <strong>{miembroSeleccionado?.nombre || miembroSeleccionado?.correo}</strong>.
                        </p>
                        <p className="alerta">⚠️ Dejarás de ser administrador de la familia.</p>

                        <div className="modal-buttons">
                            <button
                                className="btn-cancelar"
                                onClick={() => setMostrarConfirmacion(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-confirmar"
                                onClick={async () => {
                                    try {
                                        const adminActual = await gestorUsuario.obtenerUsuario();
                                        await gestorFamilia.cambiarRolAdmin(
                                            miFamilia.id,
                                            miembroSeleccionado.id,
                                            adminActual.id
                                        );
                                        setMostrarConfirmacion(false);
                                        setMensajeExito('Rol de administrador transferido con éxito');
                                        fetchMiFamilia();

                                        setTimeout(() => setMensajeExito(''), 3000);
                                    } catch (err) {
                                        alert(err.message);
                                    }
                                }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mensajeExito && (
                <div className="toast-exito">
                    <span>✅ {mensajeExito}</span>
                </div>
            )}

        </div >
    );
};

export default Familia;
