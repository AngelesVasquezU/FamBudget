import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { GestorFamilia } from '../../api/GestorFamilia';
import { GestorUsuario } from '../../api/GestorUsuario';
import { Home, PlusCircle, Edit, Trash2, Users, X } from 'lucide-react';
import { FaUsers } from "react-icons/fa";
import { ShieldUser } from 'lucide-react';
import '../../styles/Familia.css';

const Familia = () => { // VIEW-009
    const gestorUsuario = new GestorUsuario(supabase);
    const gestorFamilia = new GestorFamilia(supabase, gestorUsuario);

    const [mostrarEliminarFamilia, setMostrarEliminarFamilia] = useState(false);

    const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
    const [nuevaFamilia, setNuevaFamilia] = useState({ nombre: '' });

    const [mostrarModal, setMostrarModal] = useState(false);
    const [nuevoMiembro, setNuevoMiembro] = useState({ email: '', parentesco: '' });
    const [isLoading, setIsLoading] = useState(true);

    const [miFamilia, setMiFamilia] = useState(null);
    const [miembros, setMiembros] = useState([]);
    const [rolUsuario, setRolUsuario] = useState('');

    const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
    const [miembroSeleccionado, setMiembroSeleccionado] = useState(null);
    const [mensajeExito, setMensajeExito] = useState('');

    const fetchMiFamilia = async () => {
        setIsLoading(true);

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
        } finally {
            setIsLoading(false);
        }
    };

    // MVIEW009-1
    // Maneja la creación de una nueva familia.
    const handleCrearFamilia = async () => {
        if (!nuevaFamilia.nombre.trim()) {
            return alert("El nombre es obligatorio");
        }

        try {
            await gestorFamilia.crearFamilia(nuevaFamilia.nombre.trim());
            setMostrarModalCrear(false);
            setNuevaFamilia({ nombre: '' });
            await fetchMiFamilia();
            alert("Familia creada correctamente");
        } catch (error) {
            alert(error.message);
        }
    };

    // MVIEW009-2
    // Maneja la adición de un nuevo miembro a la familia.
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

    // MVIEW009-3
    // Maneja la eliminación de un miembro de la familia.
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

    if (isLoading) {
        return (
            <div className="familia-container">
                <div className="loading">Cargando familia...</div>
            </div>
        );
    }

    const esAdmin = rolUsuario === 'Administrador';

    if (!miFamilia) {
        return (
            <div className="familia-container">
                <h2>Grupo Familiar</h2>
                <div className="group-sin-familia">
                    <p>No perteneces a ninguna familia actualmente.</p>
                    {esAdmin && (
                        <button
                            className="btn-agregar"
                            onClick={() => setMostrarModalCrear(true)}
                        >
                            <PlusCircle size={18} /> Crear Familia
                        </button>
                    )}
                </div>

                {mostrarModalCrear && (
                    <div className="modal-overlay">
                        <div className="modal">
                            <div className="modal-header">
                                <h3>Crear nueva familia</h3>
                                <button className="btn-cerrar" onClick={() => setMostrarModalCrear(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="modal-body">
                                <label>Nombre de la familia</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Familia Rodríguez"
                                    value={nuevaFamilia.nombre}
                                    onChange={(e) => setNuevaFamilia({ nombre: e.target.value })}
                                />

                                <button
                                    className="btn-guardar"
                                    onClick={handleCrearFamilia}
                                >
                                    Crear
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="familia-container">
            <div className="title-container">
                <h2>{esAdmin ? 'Gestionar Grupo Familiar' : 'Mi Grupo Familiar'}</h2>
                <div className="group-items">
                    {esAdmin && (
                        <>
                            <button className="btn-agregar" onClick={() => setMostrarModal(true)}>
                                <PlusCircle size={18} /> Agregar Miembro
                            </button>
                            <button className="btn-eliminar-familia" onClick={() => setMostrarEliminarFamilia(true)}>
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="familia-header">
                <div className="familia-info">
                    <Home size={32} className="icono-familia" />
                    <div>
                        <h3>{miFamilia.nombre}</h3>
                        <p className="familia-nombre">
                            <FaUsers size={17} /> {miembros.length} {miembros.length > 1 ? 'miembros' : 'miembro'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="tabla-miembros">
                <h3>Miembros del Grupo</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Miembro</th>
                            <th>Correo</th>
                            <th>Rol</th>
                            {esAdmin && <th style={{ textAlign: 'center' }}>Acciones</th>}
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
                                    <td>
                                        <div className="acciones">
                                            {m.rol !== 'Administrador' && (
                                                <button
                                                    className="btn-icono editar"
                                                    onClick={() => {
                                                        setMiembroSeleccionado(m);
                                                        setMostrarConfirmacion(true);
                                                    }}
                                                >
                                                    <ShieldUser size={16} />
                                                </button>
                                            )}
                                            {m.rol !== 'Administrador' && (
                                                <button className="btn-icono eliminar" onClick={() => handleEliminarMiembro(m)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {
                mostrarModal && (
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
                )
            }

            {
                mostrarConfirmacion && (
                    <div className="modal-overlay">
                        <div className="modal modal-confirmacion">
                            <h3>¿Transferir rol de administrador?</h3>
                            <p>
                                Vas a pasar el rol de <strong>Administrador</strong> a{' '}
                                <strong>{miembroSeleccionado?.nombre || miembroSeleccionado?.correo}</strong>.
                            </p>
                            <p className="alerta">⚠️ Dejarás de ser administrador de la familia.</p>

                            <div className="modal-button">
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
                )
            }

            {mostrarEliminarFamilia && (
                <div className="modal-overlay">
                    <div className="modal modal-eliminar">
                        <h3>¿Eliminar familia?</h3>
                        <p>
                            Esta acción eliminará <strong>permanentemente</strong> la familia
                            <strong> {miFamilia.nombre}</strong> y todos los miembros quedarán sin grupo.
                        </p>

                        <p className="alerta">Esta acción no se puede deshacer.</p>

                        <div className="modal-button">
                            <button
                                className="btn-cancelar"
                                onClick={() => setMostrarEliminarFamilia(false)}
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn-confirmar eliminar"
                                onClick={async () => {
                                    try {
                                        await gestorFamilia.eliminarFamilia();
                                        setMostrarEliminarFamilia(false);
                                        setMensajeExito('Familia eliminada correctamente');

                                        // recargar datos
                                        fetchMiFamilia?.();

                                        setTimeout(() => setMensajeExito(''), 3000);
                                    } catch (err) {
                                        alert(err.message);
                                    }
                                }}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {
                mensajeExito && (
                    <div className="toast-exito">
                        <span>{mensajeExito}</span>
                    </div>
                )
            }

        </div >
    );
};

export default Familia;
