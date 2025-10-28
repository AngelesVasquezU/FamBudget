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

    const [miembroEditando, setMiembroEditando] = useState(null);
    const [nuevoParentesco, setNuevoParentesco] = useState('');

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
        if (!nuevoMiembro.email.trim() || !nuevoMiembro.parentesco.trim()) {
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
    const handleEditarMiembro = (miembro) => {
        setMiembroEditando(miembro);
        setNuevoParentesco(miembro.parentesco || '');
        setMostrarModal(true);
    };

    const handleGuardarEdicion = async () => {
        if (!nuevoParentesco.trim()) return alert('Ingresa un parentesco válido');
        try {
            await gestorFamilia.actualizarParentesco(miembroEditando.id, nuevoParentesco.trim());
            setMostrarModal(false);
            setMiembroEditando(null);
            fetchMiFamilia();
            alert('Parentesco actualizado correctamente');
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
                                        <button className="btn-icono editar" onClick={() => handleEditarMiembro(m)}>
                                            <Edit size={16} />
                                        </button>
                                        {m.rol !== 'Administrador' && (
                                            <button onClick={() => handleEliminarMiembro(m.id)}>Eliminar</button>
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
                            <h3>{miembroEditando ? 'Editar parentesco' : 'Agregar nuevo miembro'}</h3>
                            <button className="btn-cerrar" onClick={() => { setMostrarModal(false); setMiembroEditando(null); }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {miembroEditando ? (
                                <>
                                    <label>Nuevo parentesco</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Hermano, Madre..."
                                        value={nuevoParentesco}
                                        onChange={(e) => setNuevoParentesco(e.target.value)}
                                    />
                                    <button className="btn-guardar" onClick={handleGuardarEdicion}>
                                        Guardar cambios
                                    </button>
                                </>
                            ) : (
                                <>
                                    <label>Correo electrónico</label>
                                    <input
                                        type="email"
                                        placeholder="ejemplo@correo.com"
                                        value={nuevoMiembro.email}
                                        onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, email: e.target.value })}
                                    />

                                    <label>Parentesco</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Mamá, Papá, Hijo..."
                                        value={nuevoMiembro.parentesco}
                                        onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, parentesco: e.target.value })}
                                    />

                                    <button className="btn-guardar" onClick={handleAgregarMiembro}>
                                        Guardar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Familia;
