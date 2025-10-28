import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { GestorMetas } from './managers/GestorMeta';
import { useNavigate } from 'react-router-dom';
import '../styles/Metas.css';

const MetasDashboard = () => {
    const gestorMetas = new GestorMetas(supabase);
    const navigate = useNavigate();
    const [metas, setMetas] = useState([]);
    const [saldoDisponible, setSaldoDisponible] = useState(0);
    const [currentFamiliaId, setCurrentFamiliaId] = useState(null);

    const fetchDatosUsuario = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: usuarioData } = await supabase
                    .from('usuarios')
                    .select('id, familia_id')
                    .eq('auth_id', user.id)
                    .single();
                
                if (usuarioData) {
                    setCurrentFamiliaId(usuarioData.familia_id);
                    return usuarioData;
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    };

    const fetchMetas = async () => {
        try {
            if (currentFamiliaId) {
                // Aquí deberías tener una función que obtenga también las contribuciones
                // para mostrarlas en la tarjeta. Asumo que el objeto meta ya las incluye.
                const data = await gestorMetas.obtenerMetas(currentFamiliaId); 
                setMetas(data || []);
            }
        } catch (error) {
            console.error('Error fetching metas:', error);
        }
    };

    const fetchSaldoDisponible = async () => {
        try {
            if (currentFamiliaId) {
                const saldo = await gestorMetas.obtenerSaldoDisponible(currentFamiliaId);
                setSaldoDisponible(saldo);
            }
        } catch (error) {
            console.error('Error fetching saldo:', error);
        }
    };

    useEffect(() => {
        const initialize = async () => {
            const usuarioData = await fetchDatosUsuario();
            if (usuarioData) {
                await fetchMetas();
                await fetchSaldoDisponible();
            }
        };
        initialize();
    }, [currentFamiliaId]);

    const calcularProgreso = (meta) => {
        // Asegura que el valor no exceda el 100%
        return Math.min((meta.monto_actual / meta.monto_objetivo) * 100, 100); 
    };

    const calcularRestante = (meta) => {
        const restante = meta.monto_objetivo - meta.monto_actual;
        return Math.max(restante, 0); // Asegura que no sea negativo
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN'
        }).format(amount);
    };

    // Función de ejemplo para obtener contribuciones (debe venir del backend/gestor)
    const getContribuciones = (meta) => {
        // Simulación: en una app real, esto vendría del objeto 'meta'
        return meta.contribuciones || [
            { nombre: 'Mamá', monto: 1200.00 },
            { nombre: 'Papá', monto: 2175.00 }
        ];
    };

    return (
        <div className="metas-container"> {/* Usamos .metas-container aquí */}
            {/* MODIFICACIÓN CLAVE 1: Encabezado con el botón */}
            <div className="panel-de-metas">
                <h2>Panel de Metas</h2>
                <button 
                    className="new-btn" // Usamos .new-btn para el botón del header
                    onClick={() => navigate('/metas/nueva')}
                >
                    + Nueva meta
                </button>
            </div>
            
            {/* MODIFICACIÓN CLAVE 2: Panel de Saldo Disponible con nueva estructura */}
            <div className="saldo-disponible">
                <div className="saldo-info"> {/* Nuevo contenedor para el texto */}
                    <h3>Saldo de Ahorro familiar disponible</h3>
                    <p>Este saldo aún no ha sido asignado a ninguna meta</p>
                </div>
                <div className="saldo-monto">{formatCurrency(saldoDisponible)}</div>
            </div>

            {/* Lista de Metas */}
            <div className="metas-list">
                {metas.length === 0 ? (
                    <div className="no-metas">
                        <p>No hay metas creadas aún. ¡Crea tu primera meta!</p>
                    </div>
                ) : (
                    metas.map(meta => (
                        <div key={meta.id} className="meta-card">
                            <h4>{meta.nombre}</h4>
                            <p className="meta-fecha">
                                Fecha límite: {new Date(meta.fecha_limite).toLocaleDateString()}
                            </p>
                            
                            {/* MODIFICACIÓN CLAVE 3: Estructura de Progreso Compacta */}
                            <div className="meta-progreso-info">
                                <div className="meta-objetivo">
                                    Meta: <strong>{formatCurrency(meta.monto_objetivo)}</strong>
                                </div>
                                
                                <div className="progreso-container">
                                    <div className="progreso-bar">
                                        <div 
                                            className="progreso-fill" 
                                            style={{ width: `${calcularProgreso(meta)}%` }}
                                        ></div>
                                    </div>
                                    <div className="progreso-text">
                                        <span className="ahorrado">{formatCurrency(meta.monto_actual)} ahorrado</span>
                                        <span className="restante">{formatCurrency(calcularRestante(meta))} restante</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Sección de Asignación y Contribuciones (Similar a la imagen) */}
                            <div className="meta-asignado">
                                Asignado a: <strong>Toda la Familia</strong>
                                <div className="contribuciones">
                                    <h5>Contribuciones:</h5>
                                    {getContribuciones(meta).map((contribucion, index) => (
                                        <div key={index} className="contribucion-item">
                                            <span className="contribucion-nombre">{contribucion.nombre}:</span>
                                            <span className="contribucion-monto">{formatCurrency(contribucion.monto)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="meta-actions">
                                <button 
                                    className="editar-btn"
                                    onClick={() => navigate(`/metas/editar/${meta.id}`)}
                                >
                                    Editar
                                </button>
                                {/* Puedes agregar un botón para "Aportar" aquí si lo necesitas */}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MetasDashboard;