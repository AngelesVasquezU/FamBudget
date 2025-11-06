import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { GestorUsuario } from "../../api/GestorUsuario";
import { Pencil } from "lucide-react";
import "../../styles/Cuenta.css";

const Cuenta = () => {
    const gestorUsuario = new GestorUsuario(supabase);
    const [usuario, setUsuario] = useState(null);
    const [editable, setEditable] = useState(false);
    const [formData, setFormData] = useState({ nombre: "", parentesco: "" });

    useEffect(() => {
        const fetchUsuario = async () => {
            const data = await gestorUsuario.obtenerUsuario();
            setUsuario(data);
            setFormData({
                nombre: data?.nombre || "",
                parentesco: data?.parentesco || "",
            });
        };
        fetchUsuario();
    }, []);

    const handleGuardar = async () => {
        try {
            const { error } = await supabase
                .from("usuarios")
                .update({
                    nombre: formData.nombre.trim(),
                    parentesco: formData.parentesco.trim(),
                })
                .eq("id", usuario.id);

            if (error) throw error;
            alert("Datos actualizados correctamente");
            setEditable(false);
        } catch (err) {
            console.error(err);
            alert("Error al actualizar los datos");
        }
    };
    const handleCancelar = () => {
        setFormData({
            nombre: usuario.nombre,
            parentesco: usuario.parentesco,
        });
        setEditable(false);
    };

    if (!usuario) return (
        <div className="cuenta-page">
            <div className="loading">Cargando datos del usuario...</div>
        </div>
    );

    return (
        <div className="cuenta-page">
            <div className="cuenta-card">
                <div className="cuenta-left">
                    <div className="avatar">
                        <img
                            src="https://cdn-icons-png.flaticon.com/512/847/847969.png"
                            alt="User avatar"
                        />
                    </div>

                    <h3>{usuario.nombre || "User"}</h3>
                    <p>{usuario.rol}</p>
                </div>

                <div className="cuenta-right">
                    <div className="cuenta-header">
                        <h2 className="cuenta-titulo">Mi Cuenta</h2>
                        {!editable && (
                            <Pencil
                                size={18}
                                className="cuenta-edit-icon"
                                onClick={() => setEditable(true)}
                            />
                        )}
                    </div>

                    <div className="cuenta-grid">
                        <div className="cuenta-field">
                            <label>Nombre Completo</label>
                            <div className="editable-field">
                                <input
                                    type="text"
                                    value={formData.nombre}
                                    disabled={!editable}
                                    onChange={(e) =>
                                        setFormData({ ...formData, nombre: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        <div className="cuenta-field">
                            <label>Correo Electrónico</label>
                            <input type="email" value={usuario.correo} disabled />
                        </div>

                        <div className="cuenta-field">
                            <label>Rol</label>
                            <input type="text" value={usuario.rol} disabled />
                        </div>

                        <div className="cuenta-field">
                            <label>Parentesco</label>
                            <input
                                type="text"
                                value={formData.parentesco}
                                disabled={!editable}
                                onChange={(e) =>
                                    setFormData({ ...formData, parentesco: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    {editable && (
                        <div className="cuenta-actions">
                            <button className="cuenta-btn-guardar" onClick={handleGuardar}>
                                Guardar cambios
                            </button>
                            <button className="btn-cancelar" onClick={handleCancelar}>
                                Cancelar
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default Cuenta;
