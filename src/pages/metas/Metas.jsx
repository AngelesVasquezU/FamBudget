import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { GestorUsuario } from '../../api/GestorUsuario';
import { GestorMetas } from '../../api/GestorMeta';
import '../../styles/Metas.css';

const Metas = () => {
  const gestorUsuario = new GestorUsuario(supabase);
  const gestorMetas = new GestorMetas(supabase, gestorUsuario);
  const [metas, setMetas] = useState([]);
  const [selectedMetaId, setSelectedMetaId] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    fecha_limite: '',
    monto_objetivo: '',
    es_familiar: false
  });
  const fechaActual = new Date().toLocaleDateString("en-CA");
  const [saldoDisponible, setSaldoDisponible] = useState(0);
  const [aporteMonto, setAporteMonto] = useState('');
  const [showAporteModal, setShowAporteModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentFamiliaId, setCurrentFamiliaId] = useState(null);
  const [currentUsuarioId, setCurrentUsuarioId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [metaAportando, setMetaAportando] = useState(null);

  const fetchDatosUsuario = async () => {
    try {
      console.log('Iniciando obtención de datos del usuario...');

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Error de autenticación:', authError);
        throw authError;
      }

      if (!user) {
        console.error('No hay usuario autenticado');
        throw new Error('No hay usuario autenticado');
      }

      console.log('Usuario autenticado:', user.id, user.email);

      const { data: usuarioData, error: userError } = await supabase
        .from('usuarios')
        .select('id, familia_id, nombre, correo, rol')
        .eq('auth_id', user.id)
        .single();

      if (userError) {
        console.error('Error buscando usuario en BD:', userError);

        console.log('Intentando búsqueda por correo...');
        const { data: usuarioPorCorreo, error: errorCorreo } = await supabase
          .from('usuarios')
          .select('id, familia_id, nombre, correo, rol')
          .eq('correo', user.email)
          .single();

        if (errorCorreo) {
          console.error('Error buscando por correo:', errorCorreo);
          throw new Error('Usuario no encontrado en la base de datos. Contacta al administrador.');
        }

        if (usuarioPorCorreo) {
          console.log('Usuario encontrado por correo:', usuarioPorCorreo);
          return usuarioPorCorreo;
        }
      }

      if (usuarioData) {
        console.log('Usuario encontrado por auth_id:', usuarioData);
        return usuarioData;
      } else {
        throw new Error('No se encontraron datos del usuario en la base de datos');
      }
    } catch (error) {
      console.error('Error en fetchDatosUsuario:', error);
      throw error;
    }
  };

  const initializeData = async () => {
    setIsLoading(true);
    try {
      console.log('Inicializando datos...');
      const usuarioData = await fetchDatosUsuario();

      if (usuarioData) {
        console.log('Datos usuario obtenidos:', usuarioData);
        setUserData(usuarioData);
        setCurrentUsuarioId(usuarioData.id);
        setCurrentFamiliaId(usuarioData.familia_id);

        await fetchMetas(usuarioData.id, usuarioData.familia_id);
        await fetchSaldoDisponible(usuarioData.id);
      }
    } catch (error) {
      console.error('Error inicializando:', error);
      alert('Error al cargar datos: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMetas = async (usuarioId = currentUsuarioId, familiaId = currentFamiliaId) => {
    try {
      if (usuarioId) {
        console.log('Buscando metas para usuario:', usuarioId);

        let query = supabase
          .from('metas')
          .select('*');

        if (familiaId) {
          query = query.or(`usuario_id.eq.${usuarioId},familia_id.eq.${familiaId}`);
        } else {
          query = query.eq('usuario_id', usuarioId);
        }

        const { data, error } = await query.order('fecha_creacion', { ascending: false });

        if (error) throw error;

        console.log('Metas encontradas:', data);
        data.forEach(meta => {
          console.log(`Meta: ${meta.nombre}, Monto actual: ${meta.monto_actual}`);
        });
        setMetas(data || []);
      } else {
        console.warn('No hay usuarioId para buscar metas');
      }
    } catch (error) {
      console.error('Error fetching metas:', error);
    }
  };

  const fetchSaldoDisponible = async (usuarioId = currentUsuarioId) => {
    try {
      console.log("Obteniendo saldo para usuario:", usuarioId);
      if (!usuarioId) {
        console.warn("No hay usuarioId para obtener saldo");
        return;
      }

      const saldo = await gestorMetas.obtenerSaldoDisponible(usuarioId);
      console.log('Saldo disponible REAL calculado:', saldo);
      setSaldoDisponible(saldo);
    } catch (error) {
      console.error('Error fetching saldo:', error);
      setSaldoDisponible(0);
    }
  };

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    if (selectedMetaId && showForm) {
      const meta = metas.find(m => m.id === selectedMetaId);
      if (meta) {
        setFormData({
          nombre: meta.nombre,
          fecha_limite: meta.fecha_limite ? meta.fecha_limite.split('T')[0] : '',
          monto_objetivo: meta.monto_objetivo,
          es_familiar: meta.es_familiar
        });
      }
    } else if (!showForm) {
      setFormData({
        nombre: '',
        fecha_limite: '',
        monto_objetivo: '',
        es_familiar: false
      });
      setSelectedMetaId(null);
    }
  }, [selectedMetaId, metas, showForm]);

  useEffect(() => {
    const handleMetasActualizadas = () => {
      console.log('Evento recibido: metas actualizadas');
      if (userData) {
        fetchMetas(userData.id, userData.familia_id);
        fetchSaldoDisponible(userData.id);
      }
    };

    window.addEventListener('metasActualizadas', handleMetasActualizadas);

    return () => {
      window.removeEventListener('metasActualizadas', handleMetasActualizadas);
    };
  }, [userData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSave = async () => {
    const nombre = formData.nombre.trim();
    const fecha_limite = formData.fecha_limite;
    const monto_objetivo = parseFloat(formData.monto_objetivo);
    const es_familiar = formData.es_familiar;

    if (!nombre || !fecha_limite || !monto_objetivo) {
      return alert("Todos los campos son obligatorios");
    }

    if (monto_objetivo <= 0) {
      return alert("El monto objetivo debe ser mayor a 0");
    }

    try {
      if (!userData || !userData.id) {
        const refreshedUserData = await fetchDatosUsuario();
        if (!refreshedUserData) {
          throw new Error("No se pudieron obtener los datos del usuario. Por favor, recarga la página.");
        }
        setUserData(refreshedUserData);
      }

      const usuarioData = userData;

      if (es_familiar && !usuarioData.familia_id) {
        return alert("No puedes crear una meta familiar porque no perteneces a una familia. Crea una meta personal o únete a una familia primero.");
      }

      console.log('Guardando meta con datos:', {
        nombre,
        monto_objetivo,
        fecha_limite,
        familia_id: es_familiar ? usuarioData.familia_id : null,
        usuario_id: usuarioData.id,
        es_familiar
      });

      if (selectedMetaId) {
        await gestorMetas.editarMeta(selectedMetaId, {
          nombre,
          monto_objetivo,
          fecha_limite,
          es_familiar
        });
        alert('Meta actualizada correctamente');
      } else {
        await gestorMetas.crearMeta({
          nombre,
          monto_objetivo,
          fecha_limite,
          familia_id: es_familiar ? usuarioData.familia_id : null,
          usuario_id: usuarioData.id,
          es_familiar
        });
        alert('Meta creada correctamente');
      }

      setShowForm(false);
      setSelectedMetaId(null);
      setFormData({
        nombre: '',
        fecha_limite: '',
        monto_objetivo: '',
        es_familiar: false
      });

      await fetchMetas(usuarioData.id, usuarioData.familia_id);
      await fetchSaldoDisponible(usuarioData.id);

    } catch (error) {
      console.error('Error al guardar meta:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedMetaId) {
      console.error('No hay meta seleccionada para eliminar');
      return;
    }

    try {
      console.log('Iniciando eliminación de meta:', selectedMetaId);
      await gestorMetas.eliminarMeta(selectedMetaId);

      alert('Meta eliminada correctamente');

      setShowForm(false);
      setSelectedMetaId(null);
      setFormData({
        nombre: '',
        fecha_limite: '',
        monto_objetivo: '',
        es_familiar: false
      });

      if (userData) {
        await fetchMetas(userData.id, userData.familia_id);
        await fetchSaldoDisponible(userData.id);
      }

    } catch (error) {
      console.error('Error al eliminar meta:', error);
      alert(`Error al eliminar: ${error.message}`);
    }
  };

  const handleAbrirAporteModal = (meta) => {
    console.log('Abriendo modal de aporte para:', meta);

    if (!meta || !meta.id) {
      console.error('Meta inválida:', meta);
      alert('Error: No se pudo identificar la meta');
      return;
    }

    setMetaAportando(meta);
    setSelectedMetaId(meta.id);

    setFormData({
      nombre: meta.nombre,
      fecha_limite: meta.fecha_limite ? meta.fecha_limite.split('T')[0] : '',
      monto_objetivo: meta.monto_objetivo,
      es_familiar: meta.es_familiar
    });

    setShowAporteModal(true);
  };

  const handleAportar = async () => {
    console.log('Datos del aporte:', {
      metaAportando: metaAportando,
      selectedMetaId: selectedMetaId,
      aporteMonto: aporteMonto,
      userData: userData,
      saldoDisponible: saldoDisponible
    });

    if (!aporteMonto || aporteMonto <= 0) {
      return alert("Ingrese un monto válido");
    }

    const monto = parseFloat(aporteMonto);

    if (monto > saldoDisponible) {
      return alert(`Ingresos disponibles insuficientes.\nDisponible: ${formatCurrency(saldoDisponible)}\nIntenta asignar: ${formatCurrency(monto)}`);
    }

    const metaId = selectedMetaId || (metaAportando && metaAportando.id);


    if (!metaId || metaId === 'null' || metaId === 'undefined') {
      console.error('ID de meta inválido:', metaId);
      alert('Error: No se pudo identificar la meta para aportar');
      return;
    }

    if (!userData || !userData.id) {
      console.error('Datos de usuario inválidos:', userData);
      alert('Error: No se pudieron obtener los datos del usuario');
      return;
    }

    try {

      await gestorMetas.agregarAhorro(
        metaId,
        monto,
        userData.id
      );

      setAporteMonto('');
      setShowAporteModal(false);
      setMetaAportando(null);

      // Recargar datos para actualizar saldo
      await fetchMetas(userData.id, userData.familia_id);
      await fetchSaldoDisponible(userData.id); // CORREGIDO

      alert("Ingreso asignado a la meta correctamente");

    } catch (error) {
      console.error('Error al asignar ingreso a meta:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleCerrarAporteModal = () => {
    setShowAporteModal(false);
    setMetaAportando(null);
    setAporteMonto('');
  };

  const calcularProgreso = (meta) => {
    if (!meta.monto_objetivo || meta.monto_objetivo === 0) return 0;
    return (meta.monto_actual / meta.monto_objetivo) * 100;
  };

  const calcularRestante = (meta) => {
    return meta.monto_objetivo - meta.monto_actual;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="metas-container">
        <div className="loading">Cargando metas...</div>
      </div>
    );
  }

  return (
    <div className="metas-container">
      {!showForm ? (
        <>
          <div className="saldo-disponible">
            <h3>Ingresos disponibles para metas</h3>
            <p>Estos son los ingresos que aún no han sido asignados a ninguna meta</p>
            <div className="saldo-separator"></div>
            <div className="saldo-monto">{formatCurrency(saldoDisponible)}</div>
          </div>

          <div className="nueva-meta-section">
            <button className="nueva-meta-btn" onClick={() => setShowForm(true)}>
              + Nueva Meta
            </button>
          </div>

          <div className="metas-list">
            {metas.length === 0 ? (
              <div className="no-metas">
                <p>No hay metas creadas aún. ¡Crea tu primera meta!</p>
              </div>
            ) : (
              metas.map(meta => (
                <div key={meta.id} className="meta-card">
                  <h4>{meta.nombre}</h4>
                  <div className="meta-header-info">
                    <div className="meta-fecha">
                      Fecha límite: {new Date(meta.fecha_limite).toLocaleDateString()}
                    </div>
                    <div className={`meta-tipo ${meta.es_familiar ? 'familiar' : 'personal'}`}>
                      {meta.es_familiar ? '🏠 Familiar' : '👤 Personal'}
                    </div>
                  </div>

                  <div className="meta-monto-info">
                    <div className="monto-item monto-meta">
                      <span className="monto-label">Meta</span>
                      <span className="monto-valor">{formatCurrency(meta.monto_objetivo)}</span>
                    </div>
                    <div className="monto-item monto-ahorrado">
                      <span className="monto-label">Ahorrado</span>
                      <span className="monto-valor">{formatCurrency(meta.monto_actual)}</span>
                    </div>
                    <div className="monto-item monto-restante">
                      <span className="monto-label">Restante</span>
                      <span className="monto-valor">{formatCurrency(calcularRestante(meta))}</span>
                    </div>
                  </div>

                  <div className="progreso-container">
                    <div className="progreso-bar">
                      <div
                        className="progreso-fill"
                        style={{ width: `${calcularProgreso(meta)}%` }}
                      ></div>
                    </div>
                    <div className="progreso-text">
                      <span>{calcularProgreso(meta).toFixed(1)}% completado</span>
                      <span>{formatCurrency(meta.monto_actual)} de {formatCurrency(meta.monto_objetivo)}</span>
                    </div>
                  </div>

                  <div className="meta-actions">
                    <button
                      className="editar-btn"
                      onClick={() => {
                        setSelectedMetaId(meta.id);
                        setShowForm(true);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="aporte-btn"
                      onClick={() => handleAbrirAporteModal(meta)}
                      disabled={calcularProgreso(meta) >= 100}
                    >
                      Asignar Ingreso
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="metas-form-container">
          <div className="metas-form">
            <h3>{selectedMetaId ? 'Editar Meta' : 'Nueva Meta'}</h3>

            <div className="form-group-metas">
              <label>Nombre de la meta</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Ej: Viaje a Cancún"
              />
            </div>

            <div className="form-group-metas">
              <label>Fecha límite</label>
              <input
                type="date"
                name="fecha_limite"
                value={formData.fecha_limite}
                onChange={handleChange}
                min={fechaActual}
              />
            </div>

            <div className="form-group-metas">
              <label>Monto objetivo (S/.)</label>
              <input
                type="number"
                name="monto_objetivo"
                value={formData.monto_objetivo}
                onChange={handleChange}
                placeholder="4500.00"
                step="0.01"
                min="0.01"
              />
            </div>

            {userData?.familia_id && (
              <div className="form-group-metas checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="es_familiar"
                    checked={formData.es_familiar}
                    onChange={handleChange}
                  />
                  Meta familiar (compartida con la familia)
                </label>
              </div>
            )}

            <div className="form-buttons">
              <button className="metas-save-btn" onClick={handleSave}>
                {selectedMetaId ? 'Actualizar' : 'Crear'} Meta
              </button>

              {selectedMetaId && (
                <button className="delete-btn" onClick={() => {
                  if (window.confirm("¿Estás seguro de eliminar esta meta? Esta acción no se puede deshacer.")) {
                    handleDelete();
                  }
                }}>
                  Eliminar
                </button>
              )}

              <button
                className="cancel-btn"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAporteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Asignar Ingreso a Meta</h3>
            <p>
              <strong>Meta:</strong> {metaAportando?.nombre || formData.nombre || 'No disponible'}
            </p>
            {metaAportando && (
              <>
                <p>
                  <strong>Progreso actual:</strong> {calcularProgreso(metaAportando).toFixed(1)}%
                  ({formatCurrency(metaAportando.monto_actual)} de {formatCurrency(metaAportando.monto_objetivo)})
                </p>
                <p>
                  <strong>Ingresos disponibles:</strong> {formatCurrency(saldoDisponible)}
                </p>
              </>
            )}

            <div className="form-group-metas">
              <label>Monto a asignar de ingresos (S/.)</label>
              <input
                type="number"
                value={aporteMonto}
                onChange={(e) => setAporteMonto(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                max={Math.min(
                  metaAportando ? calcularRestante(metaAportando) : saldoDisponible,
                  saldoDisponible
                )}
              />
              {metaAportando && (
                <small className="monto-maximo">
                  Límites: Meta - {formatCurrency(calcularRestante(metaAportando))} | Ingresos - {formatCurrency(saldoDisponible)}
                </small>
              )}
            </div>

            <div className="modal-buttons">
              <button
                className="metas-save-btn"
                onClick={handleAportar}
                disabled={!aporteMonto || aporteMonto <= 0}
              >
                Asignar Ingreso
              </button>
              <button
                className="cancel-btn"
                onClick={handleCerrarAporteModal}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Metas;