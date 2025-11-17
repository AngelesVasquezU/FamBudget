import { useEffect, useState } from "react";
import { FaEdit } from 'react-icons/fa';
import { supabase } from "../../supabaseClient";
import { GestorUsuario } from "../../api/GestorUsuario";
import { GestorConcepto } from "../../api/GestorConcepto";
import { GestorMovimiento } from "../../api/GestorMovimiento";
import { GestorMetas } from "../../api/GestorMeta";
import "../../styles/Balance.css";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(amount);
};

const Balance = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [tipoBalance, setTipoBalance] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('');
  const [fechaInicio, setFechaInicio] = useState('01/01/2025');
  const [fechaFin, setFechaFin] = useState('30/04/2025');
  const [topEgresos, setTopEgresos] = useState([]);
  const [topIngresos, setTopIngresos] = useState([]);
  const [totalEgresos, setTotalEgresos] = useState(0);
  const [totalIngresos, setTotalIngresos] = useState(0);
  const [balanceData, setBalanceData] = useState(null);
  const [generandoBalance, setGenerandoBalance] = useState(false);
  const [error, setError] = useState(null);

  // Estados para el panel de movimientos
  const [panelMovimientosAbierto, setPanelMovimientosAbierto] = useState(false);
  const [conceptos, setConceptos] = useState([]);
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState(null);
  const [movimientosConcepto, setMovimientosConcepto] = useState([]);
  const [filtroTiempo, setFiltroTiempo] = useState('todos');
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);

  // Inicializar gestores
  const gestores = (() => {
    try {
      console.log("Inicializando gestores con supabase:", supabase);
      
      if (!supabase) {
        throw new Error("Supabase no está disponible");
      }

      const gestorUsuario = new GestorUsuario(supabase);
      const gestorMeta = new GestorMetas(supabase, gestorUsuario);
      const gestorMovimiento = new GestorMovimiento(supabase, gestorMeta);
      const gestorConcepto = new GestorConcepto(supabase, gestorUsuario);

      return {
        gestorUsuario,
        gestorMeta,
        gestorMovimiento,
        gestorConcepto
      };
    } catch (err) {
      console.error("Error inicializando gestores:", err);
      return null;
    }
  })();

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      if (!gestores) {
        setError("Gestores no inicializados");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        console.log("Obteniendo usuario...");
        const usuario = await gestores.gestorUsuario.obtenerUsuario();
        
        if (!usuario) {
          throw new Error("No se pudo obtener el usuario");
        }

        console.log("Usuario obtenido:", usuario);
        setUser(usuario);
        await cargarResumen(usuario.id);

      } catch (err) {
        console.error("Error cargando balance:", err);
        setError("Error al cargar los datos: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    cargarDatosIniciales();
  }, []);

  const cargarResumen = async (userId) => {
    if (!gestores) return;

    try {
      console.log("Cargando resumen para usuario:", userId);
      
      // Usar los mismos métodos que el Dashboard para obtener totales
      const ingresosTotales = await gestores.gestorMovimiento.obtenerTotalPorTipo(userId, "ingreso");
      const egresosTotales = await gestores.gestorMovimiento.obtenerTotalPorTipo(userId, "egreso");

      console.log("Ingresos totales:", ingresosTotales);
      console.log("Egresos totales:", egresosTotales);

      setTotalEgresos(egresosTotales || 0);
      setTotalIngresos(ingresosTotales || 0);

      // Obtener movimientos para calcular top conceptos - Vamos a usar una consulta directa
      const { data: movimientos, error } = await supabase
        .from('movimientos')
        .select(`
          id,
          monto,
          concepto_id,
          conceptos (
            id,
            nombre,
            tipo
          )
        `)
        .eq('usuario_id', userId)
        .order('fecha', { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error obteniendo movimientos:", error);
        return;
      }

      console.log("Movimientos obtenidos:", movimientos);

      // Procesar datos para top conceptos - Método mejorado
      const conceptosMap = {};
      
      movimientos?.forEach(mov => {
        if (mov.conceptos && mov.conceptos.nombre) {
          const conceptoId = mov.conceptos.id;
          const nombre = mov.conceptos.nombre;
          const tipo = mov.conceptos.tipo;
          const monto = parseFloat(mov.monto) || 0;

          // Solo procesar si el monto es positivo
          if (monto > 0) {
            if (!conceptosMap[conceptoId]) {
              conceptosMap[conceptoId] = {
                id: conceptoId,
                nombre: nombre,
                tipo: tipo,
                total: 0
              };
            }
            conceptosMap[conceptoId].total += monto;
          }
        }
      });

      console.log("Conceptos mapeados:", conceptosMap);

      // Separar y ordenar conceptos
      const egresosArray = Object.values(conceptosMap).filter(c => c.tipo === 'egreso');
      const ingresosArray = Object.values(conceptosMap).filter(c => c.tipo === 'ingreso');

      console.log("Todos los egresos:", egresosArray);
      console.log("Todos los ingresos:", ingresosArray);

      // Ordenar por total descendente y tomar top 3
      const topEgresos = egresosArray
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      const topIngresos = ingresosArray
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      console.log("Top 3 egresos:", topEgresos);
      console.log("Top 3 ingresos:", topIngresos);

      setTopEgresos(topEgresos);
      setTopIngresos(topIngresos);

    } catch (error) {
      console.error('Error cargando resumen:', error);
      setError("Error al cargar el resumen: " + error.message);
    }
  };

  // Función para abrir el panel de movimientos
  const abrirPanelMovimientos = async () => {
    if (!gestores || !user) {
      setError("Gestores o usuario no disponibles");
      return;
    }

    setPanelMovimientosAbierto(true);
    setCargandoMovimientos(true);

    try {
      // Cargar todos los conceptos
      const todosConceptos = await gestores.gestorConcepto.obtenerConceptos();
      setConceptos(todosConceptos || []);

      // Si ya hay un concepto seleccionado, cargar sus movimientos con el filtro actual
      if (conceptoSeleccionado) {
        await cargarMovimientosPorConcepto(conceptoSeleccionado);
      }

    } catch (error) {
      console.error("Error cargando panel de movimientos:", error);
      setError("Error al cargar los movimientos");
    } finally {
      setCargandoMovimientos(false);
    }
  };

  // Función para cargar movimientos de un concepto específico
  const cargarMovimientosPorConcepto = async (concepto, forzarFiltro = null) => {
    if (!user) return;

    setConceptoSeleccionado(concepto);
    setCargandoMovimientos(true);

    try {
      let query = supabase
        .from('movimientos')
        .select(`
          *,
          conceptos:concepto_id(*),
          usuarios:usuario_id(nombre),
          ahorro:ahorro(monto)
        `)
        .eq('usuario_id', user.id)
        .eq('concepto_id', concepto.id)
        .order('fecha', { ascending: false });

      // Usar el filtro forzado o el filtro actual
      const filtroAAplicar = forzarFiltro !== null ? forzarFiltro : filtroTiempo;

      // Aplicar filtro de tiempo si no es "todos"
      if (filtroAAplicar !== 'todos') {
        const hoy = new Date();
        let fechaInicioFiltro, fechaFinFiltro;

        switch (filtroAAplicar) {
          case 'dia':
            fechaInicioFiltro = new Date(hoy);
            fechaFinFiltro = new Date(hoy);
            break;
          case 'semana':
            fechaInicioFiltro = new Date(hoy);
            fechaInicioFiltro.setDate(hoy.getDate() - hoy.getDay() + (hoy.getDay() === 0 ? -6 : 1));
            fechaFinFiltro = new Date(hoy);
            break;
          case 'quincena':
            fechaInicioFiltro = new Date(hoy);
            fechaInicioFiltro.setDate(hoy.getDate() - 15);
            fechaFinFiltro = new Date(hoy);
            break;
          case 'mes':
            fechaInicioFiltro = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            fechaFinFiltro = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
            break;
          default:
            break;
        }

        // Formatear a YYYY-MM-DD
        const fechaInicioStr = fechaInicioFiltro.toISOString().split('T')[0];
        const fechaFinStr = fechaFinFiltro.toISOString().split('T')[0];

        console.log(`Filtro ${filtroAAplicar}: ${fechaInicioStr} a ${fechaFinStr}`);

        query = query
          .gte('fecha', fechaInicioStr)
          .lte('fecha', fechaFinStr);
      }

      const { data: movimientos, error } = await query;

      if (error) throw error;

      console.log('Movimientos encontrados:', movimientos);
      setMovimientosConcepto(movimientos || []);

    } catch (error) {
      console.error("Error cargando movimientos del concepto:", error);
      setError("Error al cargar los movimientos del concepto");
    } finally {
      setCargandoMovimientos(false);
    }
  };

  // Función para manejar cambio de filtro de tiempo
  const manejarCambioFiltro = async (nuevoFiltro) => {
    setFiltroTiempo(nuevoFiltro);
    
    // Si hay un concepto seleccionado, recargar los movimientos con el nuevo filtro
    if (conceptoSeleccionado) {
      await cargarMovimientosPorConcepto(conceptoSeleccionado, nuevoFiltro);
    }
  };
  // Función para obtener el texto descriptivo del rango de fechas
  const obtenerTextoRangoFechas = (filtro) => {
    const hoy = new Date();
    
    switch (filtro) {
      case 'dia':
        return `(Hoy: ${hoy.toLocaleDateString('es-PE')})`;
      case 'semana':
        const lunes = new Date();
        lunes.setDate(lunes.getDate() - lunes.getDay() + (lunes.getDay() === 0 ? -6 : 1));
        return `(Esta semana: ${lunes.toLocaleDateString('es-PE')} - ${hoy.toLocaleDateString('es-PE')})`;
      case 'quincena':
        const hace15Dias = new Date();
        hace15Dias.setDate(hace15Dias.getDate() - 15);
        return `(Últimos 15 días: ${hace15Dias.toLocaleDateString('es-PE')} - ${hoy.toLocaleDateString('es-PE')})`;
      case 'mes':
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        return `(Este mes: ${inicioMes.toLocaleDateString('es-PE')} - ${finMes.toLocaleDateString('es-PE')})`;
      default:
        return '';
    }
  };

  const generarBalance = async () => {
    if (!gestores || !user) {
      setError("Gestores o usuario no disponibles");
      return;
    }

    if (!tipoBalance || !tipoMovimiento) {
      alert('Por favor selecciona tipo de balance y tipo de movimiento');
      return;
    }

    setGenerandoBalance(true);
    setError(null);
    
    try {
      const user_id = user.id;

      // Obtener datos del usuario y familia
      const { data: usuario, error: errorUsuario } = await supabase
        .from('usuarios')
        .select('familia_id, saldo_disponible')
        .eq('id', user_id)
        .single();

      if (errorUsuario) throw errorUsuario;

      let movimientos = [];
      let total = 0;

      // Si es tipo "todos", obtener ambos tipos
      if (tipoMovimiento === 'todos') {
        const ingresos = await gestores.gestorMovimiento.obtenerMovimientosUsuario(user_id, {
          tipo: 'ingreso',
          fechaInicio: convertirFecha(fechaInicio),
          fechaFin: convertirFecha(fechaFin)
        });
        
        const egresos = await gestores.gestorMovimiento.obtenerMovimientosUsuario(user_id, {
          tipo: 'egreso',
          fechaInicio: convertirFecha(fechaInicio),
          fechaFin: convertirFecha(fechaFin)
        });

        movimientos = [...ingresos || [], ...egresos || []];
        total = movimientos.reduce((sum, mov) => sum + parseFloat(mov.monto || 0), 0);
      } 
      // Si es ahorro
      else if (tipoMovimiento === 'ahorro') {
        const { data: ahorros, error: errorAhorros } = await supabase
          .from('ahorro')
          .select(`
            *,
            metas:meta_id(nombre),
            movimientos:movimiento_id(*, conceptos:concepto_id(nombre, tipo))
          `)
          .gte('created_at', convertirFecha(fechaInicio))
          .lte('created_at', convertirFecha(fechaFin));

        if (errorAhorros) throw errorAhorros;

        const balanceAhorros = {
          tipo: 'ahorro',
          total: ahorros?.reduce((sum, ahorro) => sum + parseFloat(ahorro.monto || 0), 0) || 0,
          movimientos: ahorros?.map(ahorro => ({
            id: ahorro.id,
            monto: ahorro.monto,
            fecha: ahorro.created_at,
            concepto: ahorro.metas?.nombre || 'Ahorro',
            tipo: 'ahorro'
          })) || []
        };

        setBalanceData(balanceAhorros);
        return;
      }
      // Para ingreso o egreso
      else {
        movimientos = await gestores.gestorMovimiento.obtenerMovimientosUsuario(user_id, {
          tipo: tipoMovimiento,
          fechaInicio: convertirFecha(fechaInicio),
          fechaFin: convertirFecha(fechaFin)
        });
        
        total = (movimientos || []).reduce((sum, mov) => sum + parseFloat(mov.monto || 0), 0);
      }

      // Filtrar por tipo de balance (familiar)
      if (tipoBalance === 'familiar' && usuario.familia_id) {
        // Obtener movimientos familiares
        const { data: movimientosFamilia, error } = await supabase
          .from('movimientos')
          .select(`
            *,
            conceptos:concepto_id(nombre, tipo)
          `)
          .eq('familia_id', usuario.familia_id)
          .gte('fecha', convertirFecha(fechaInicio))
          .lte('fecha', convertirFecha(fechaFin))
          .order('fecha', { ascending: false });

        if (error) throw error;

        if (tipoMovimiento !== 'todos') {
          movimientos = (movimientosFamilia || []).filter(mov => mov.conceptos?.tipo === tipoMovimiento);
        } else {
          movimientos = movimientosFamilia || [];
        }

        total = movimientos.reduce((sum, mov) => sum + parseFloat(mov.monto || 0), 0);
      }

      setBalanceData({
        tipo: tipoMovimiento,
        total,
        movimientos: (movimientos || []).map(mov => ({
          id: mov.id,
          monto: mov.monto,
          fecha: mov.fecha,
          concepto: mov.conceptos?.nombre,
          tipo: mov.conceptos?.tipo || mov.tipo
        }))
      });

    } catch (error) {
      console.error('Error generando balance:', error);
      setError('Error al generar el balance: ' + error.message);
    } finally {
      setGenerandoBalance(false);
    }
  };

  const convertirFecha = (fechaDDMMAAAA) => {
    const [dia, mes, anio] = fechaDDMMAAAA.split('/');
    return `${anio}-${mes}-${dia}`;
  };

  // Si hay un error en la inicialización de gestores
  if (!gestores) {
    return (
      <div className="balance">
        <div className="error-message">
          <h2>Error de Inicialización</h2>
          <p>No se pudieron inicializar los gestores. Verifica la configuración de Supabase.</p>
          <button onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="balance">
        <div className="loading">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="balance">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      </div>
    );
  }

   return (
    <div className="balance">
      {/* Panel de Movimientos - VERSIÓN CORREGIDA */}
      {panelMovimientosAbierto && (
        <div className="panel-movimientos-overlay">
          <div className="panel-movimientos">
            <div className="panel-header">
              <h2>Gastos e Ingresos</h2>
              <button 
                className="cerrar-panel"
                onClick={() => setPanelMovimientosAbierto(false)}
              >
                ×
              </button>
            </div>

            <div className="panel-contenido">
              {/* Columna izquierda - Lista de conceptos */}
              <div className="conceptos-lista">
                <h3>Conceptos</h3>
                <ul>
                  {conceptos.map(concepto => (
                    <li 
                      key={concepto.id}
                      className={conceptoSeleccionado?.id === concepto.id ? 'seleccionado' : ''}
                      onClick={() => cargarMovimientosPorConcepto(concepto)}
                    >
                      <strong>{concepto.nombre}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Columna derecha - Detalles del concepto seleccionado */}
              <div className="movimientos-detalle">
                <div className="detalle-header">
                  <div className="filtro-tiempo">
                    <select 
                      value={filtroTiempo}
                      onChange={(e) => manejarCambioFiltro(e.target.value)}
                    >
                      <option value="todos">Todos</option>
                      <option value="dia">Día</option>
                      <option value="semana">Semana</option>
                      <option value="quincena">Quincena</option>
                      <option value="mes">Mes</option>
                    </select>
                    
                    {/* Indicador del rango de fechas */}
                    {filtroTiempo !== 'todos' && (
                      <span className="rango-fechas-info">
                        {obtenerTextoRangoFechas(filtroTiempo)}
                      </span>
                    )}
                  </div>
                  <h3>
                    {conceptoSeleccionado 
                      ? `Movimientos: ${conceptoSeleccionado.nombre}` 
                      : 'Selecciona un concepto'}
                  </h3>
                </div>

                {!conceptoSeleccionado ? (
                  <div className="sin-seleccion">
                    Por favor, selecciona un concepto de la lista para ver los movimientos
                  </div>
                ) : cargandoMovimientos ? (
                  <div className="cargando-movimientos">Cargando movimientos...</div>
                ) : (
                  <div className="tabla-movimientos-container">
                    {movimientosConcepto.length > 0 ? (
                      <table className="tabla-movimientos">
                        <thead>
                          <tr>
                            <th>Perfil</th>
                            <th>Fecha</th>
                            <th>Monto</th>
                            <th>Ahorro</th>
                            <th>Comentario</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientosConcepto.map(movimiento => (
                            <tr key={movimiento.id}>
                              <td>{movimiento.usuarios?.nombre || 'Usuario'}</td>
                              <td>{new Date(movimiento.fecha).toLocaleDateString('es-ES')}</td>
                              <td className={movimiento.conceptos?.tipo === 'egreso' ? 'negativo' : 'positivo'}>
                                {movimiento.conceptos?.tipo === 'egreso' ? '-' : '+'} 
                                {formatCurrency(movimiento.monto)}
                              </td>
                              <td>
                                {movimiento.ahorro && movimiento.ahorro.length > 0 
                                  ? formatCurrency(movimiento.ahorro[0].monto)
                                  : 'S/.0.00'
                                }
                              </td>
                              <td>{movimiento.comentario || 'Sin comentario'}</td>
                              <td>
                                <button className="btn-editar" title="Editar movimiento">
                                  <FaEdit size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="sin-movimientos">
                        No hay movimientos para mostrar con los filtros seleccionados
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* El resto de tu componente se mantiene EXACTAMENTE igual */}
      <div className="balance__header">
        <h1>Balance</h1>
      </div>

      {/* Sección Resumen */}
      <div className="balance-resumen">
        <div className="resumen-card">
          <h2>Resumen</h2>
          
          <div className="conceptos-grid">
            <div className="conceptos-columna">
              <h3>Egresos :</h3>
              <ul>
                {topEgresos.map((concepto, index) => (
                  <li key={concepto.id || index}>
                    • {concepto.nombre} 
                    <span className="monto-concepto">{formatCurrency(concepto.total)}</span>
                  </li>
                ))}
                {topEgresos.length === 0 && totalEgresos > 0 && (
                  <li>• No se pudieron agrupar los egresos por concepto</li>
                )}
                {topEgresos.length === 0 && totalEgresos === 0 && (
                  <li>• No hay egresos registrados</li>
                )}
              </ul>
            </div>

            <div className="conceptos-columna">
              <h3>Ingresos :</h3>
              <ul>
                {topIngresos.map((concepto, index) => (
                  <li key={concepto.id || index}>
                    • {concepto.nombre}
                    <span className="monto-concepto">{formatCurrency(concepto.total)}</span>
                  </li>
                ))}
                {topIngresos.length === 0 && totalIngresos > 0 && (
                  <li>• No se pudieron agrupar los ingresos por concepto</li>
                )}
                {topIngresos.length === 0 && totalIngresos === 0 && (
                  <li>• No hay ingresos registrados</li>
                )}
              </ul>
            </div>
          </div>

          <div className="resumen-totales">
            <div className="total-item">
              <span>Total Egresos:</span>
              <span className="total-monto">{formatCurrency(totalEgresos)}</span>
            </div>
            <div className="total-item">
              <span>Total Ingresos:</span>
              <span className="total-monto">{formatCurrency(totalIngresos)}</span>
            </div>
          </div>

          <div className="resumen-actions">
            <button 
              className="btn-ver-movimientos"
              onClick={abrirPanelMovimientos}
            >
              Ver Movimientos
            </button>
          </div>
        </div>
      </div>

      {/* Sección Balance Personalizado */}
      <div className="balance-personalizado">
        <div className="personalizado-card">
          <h2>Balance Personalizado</h2>

          <div className="filtros-section">
            <div className="filtro-group">
              <label>Selecciona tipo de balance</label>
              <select 
                value={tipoBalance} 
                onChange={(e) => setTipoBalance(e.target.value)}
                className="select-filtro"
              >
                <option value="">Seleccionar</option>
                <option value="personal">Personal</option>
                <option value="familiar">Familiar</option>
              </select>
            </div>

            <div className="filtro-group">
              <label>Selecciona tipo de movimiento</label>
              <select 
                value={tipoMovimiento} 
                onChange={(e) => setTipoMovimiento(e.target.value)}
                className="select-filtro"
              >
                <option value="">Seleccionar</option>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
                <option value="ahorro">Ahorro</option>
                <option value="todos">Todos</option>
              </select>
            </div>

            <div className="fechas-group">
              <div className="fecha-input-group">
                <label>Fecha de Inicio</label>
                <div className="fecha-input-container">
                  <input 
                    type="text" 
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="fecha-input"
                    placeholder="DD/MM/AAAA"
                  />
                </div>
              </div>

              <div className="fecha-input-group">
                <label>Fecha de Fin</label>
                <div className="fecha-input-container">
                  <input 
                    type="text" 
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="fecha-input"
                    placeholder="DD/MM/AAAA"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="balance-actions">
            <button 
              className="btn-generar-balance"
              onClick={generarBalance}
              disabled={generandoBalance}
            >
              {generandoBalance ? 'Generando...' : 'Generar Balance'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Balance;