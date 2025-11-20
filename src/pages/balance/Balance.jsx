import { useEffect, useState } from "react";
import { FaEdit, FaEye } from 'react-icons/fa';
import { supabase } from "../../supabaseClient";
import { GestorUsuario } from "../../api/GestorUsuario";
import { GestorConcepto } from "../../api/GestorConcepto";
import { GestorMovimiento } from "../../api/GestorMovimiento";
import { GestorMetas } from "../../api/GestorMeta";
import BalanceChart from "../../pages/balance/BalanceChart";
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
  const [periodo, setPeriodo] = useState('');
  const [tipoBalance, setTipoBalance] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
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
  const [comentarioSeleccionado, setComentarioSeleccionado] = useState(null); // Nuevo estado para el modal de comentario
  const [modalBalanceAbierto, setModalBalanceAbierto] = useState(false);

  // Estados para el modal de edición
  const [movimientoEditando, setMovimientoEditando] = useState(null);
  const [modalEdicionAbierto, setModalEdicionAbierto] = useState(false);
  const [guardandoCambios, setGuardandoCambios] = useState(false);

  // Inicializar gestores
  const gestores = (() => {
    try {
      console.log("Inicializando gestores con supabase:", supabase);

      if (!supabase) {
        throw new Error("Supabase no está disponible");
      }

      const gestorUsuario = new GestorUsuario(supabase);
      const gestorMeta = new GestorMetas(supabase, gestorUsuario);
      const gestorMovimiento = new GestorMovimiento(supabase, gestorMeta, gestorUsuario);
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

      await cargarTodosLosMovimientos();

    } catch (error) {
      console.error("Error cargando panel de movimientos:", error);
      setError("Error al cargar los movimientos");
    } finally {
      setCargandoMovimientos(false);
    }
  };

  const manejarCambioFiltro = async (nuevoFiltro) => {
    setFiltroTiempo(nuevoFiltro);

    if (conceptoSeleccionado) {
      await cargarMovimientosPorConcepto(conceptoSeleccionado, nuevoFiltro);
    } else {
      // Si no hay concepto seleccionado (es decir, estamos en "Todos los conceptos")
      await cargarTodosLosMovimientos(nuevoFiltro);
    }
  };

  // Función para abrir el modal de edición
  const abrirModalEdicion = (movimiento) => {
    setMovimientoEditando(movimiento);
    setModalEdicionAbierto(true);
  };

  // Función para cerrar el modal de edición
  const cerrarModalEdicion = () => {
    setModalEdicionAbierto(false);
    setMovimientoEditando(null);
  };

  // Función para guardar los cambios del movimiento
  const guardarMovimientoEditado = async () => {
    if (!movimientoEditando || !gestores) return;

    setGuardandoCambios(true);

    try {
      const { error } = await supabase
        .from('movimientos')
        .update({
          monto: movimientoEditando.monto,
          fecha: movimientoEditando.fecha,
          comentario: movimientoEditando.comentario,
          // Agrega aquí otros campos que quieras editar
        })
        .eq('id', movimientoEditando.id);

      if (error) throw error;

      // Actualizar la lista de movimientos
      setMovimientosConcepto(prev =>
        prev.map(mov =>
          mov.id === movimientoEditando.id ? movimientoEditando : mov
        )
      );

      cerrarModalEdicion();
      // Opcional: mostrar mensaje de éxito
      alert('Movimiento actualizado correctamente');

    } catch (error) {
      console.error('Error al actualizar movimiento:', error);
      setError('Error al actualizar el movimiento: ' + error.message);
    } finally {
      setGuardandoCambios(false);
    }
  };

  const generarBalance = async () => {
    if (!gestores || !user) {
      setError("Gestores o usuario no disponibles");
      return;
    }

    if (!tipoBalance || !periodo) {
      alert('Selecciona tipo de balance y periodo');
      return;
    }

    setGenerandoBalance(true);
    setError(null);

    try {
      const userId = user.id;
      let fechaInicioPeriodo, fechaFinPeriodo;

      // --- Manejo de fechas según el periodo ---
      if (periodo === 'personalizado') {
        if (!fechaInicio || !fechaFin) {
          alert("Por favor ingresa fechas válidas para el balance personalizado.");
          setGenerandoBalance(false);
          return;
        }
        const convertirFecha = (fechaStr) => {
          if (!fechaStr) return null;

          // Si viene en formato ISO 'YYYY-MM-DD'
          if (fechaStr.includes('-')) {
            const [yyyy, mm, dd] = fechaStr.split('-');
            return new Date(yyyy, mm - 1, dd); // mes 0-indexed
          }

          // Si viene en formato 'DD/MM/YYYY'
          const parts = fechaStr.split('/');
          if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
          }

          return null;
        };


        fechaInicioPeriodo = convertirFecha(fechaInicio);
        fechaFinPeriodo = convertirFecha(fechaFin);

        if (!fechaInicioPeriodo || !fechaFinPeriodo) {
          alert("Formato de fecha inválido. Usa DD/MM/AAAA");
          setGenerandoBalance(false);
          return;
        }

      } else {
        ({ fechaInicioPeriodo, fechaFinPeriodo } = calcularRangoPorPeriodo(periodo, fechaInicio, fechaFin));
      }

      const balance = await gestores.gestorMovimiento.obtenerBalanceEntreFechas({
        fechaInicio: fechaInicioPeriodo,
        fechaFin: fechaFinPeriodo,
        tipo: tipoBalance,
        usuarioId: userId
      });

      const conceptosMap = {};
      balance.movimientos.forEach(m => {
        const conceptoId = m.concepto_id || m.id;
        const nombre = m.conceptos?.nombre || m.concepto || 'Sin concepto';
        const tipo = m.conceptos?.tipo || m.tipo;
        const monto = Number(m.monto);
        const fecha = m.fecha?.split('T')[0];

        if (!conceptosMap[conceptoId]) {
          conceptosMap[conceptoId] = { id: conceptoId, nombre, tipo, ingresos: 0, egresos: 0, fechas: [] };
        }

        if (tipo === 'ingreso') conceptosMap[conceptoId].ingresos += monto;
        else if (tipo === 'egreso') conceptosMap[conceptoId].egresos += monto;

        if (fecha && !conceptosMap[conceptoId].fechas.includes(fecha)) {
          conceptosMap[conceptoId].fechas.push(fecha);
        }
      });

      const ahorro = balance.totales.ingresos - balance.totales.egresos;

      setBalanceData({
        tipo: tipoBalance,
        total: ahorro,
        movimientos: balance.movimientos,
        fechas: { inicio: fechaInicioPeriodo, fin: fechaFinPeriodo },
        resumen: {
          totalIngresos: balance.totales.ingresos,
          totalEgresos: balance.totales.egresos,
          ahorro,
          tendencia: ahorro >= 0 ? 'Positiva' : 'Negativa',
          conceptos: Object.values(conceptosMap)
        }
      });

      setModalBalanceAbierto(true);

    } catch (error) {
      console.error('Error generando balance:', error);
      setError('Error al generar el balance: ' + error.message);
    } finally {
      setGenerandoBalance(false);
    }
  };



  // Función para obtener el rango de fechas según el periodo y en caso sea personalizado
  const calcularRangoPorPeriodo = (periodo) => {
    const hoy = new Date();
    let fechaInicioPeriodo, fechaFinPeriodo;

    const formatDate = (date) => date.toISOString().split('T')[0];

    switch (periodo) {
      case 'hoy':
        fechaInicioPeriodo = formatDate(hoy);
        fechaFinPeriodo = formatDate(hoy);
        break;

      case '7dias':
        fechaInicioPeriodo = formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6));
        fechaFinPeriodo = formatDate(hoy);
        break;

      case '30dias':
        fechaInicioPeriodo = formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 29));
        fechaFinPeriodo = formatDate(hoy);
        break;

      case 'mes_actual':
        fechaInicioPeriodo = formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        fechaFinPeriodo = formatDate(hoy);
        break;

      case 'año_actual':
        fechaInicioPeriodo = formatDate(new Date(hoy.getFullYear(), 0, 1));
        fechaFinPeriodo = formatDate(hoy);
        break;

      case 'personalizado':
        fechaInicioPeriodo = fechaInicio;
        fechaFinPeriodo = fechaFin;
        break;

      default:
        fechaInicioPeriodo = formatDate(hoy);
        fechaFinPeriodo = formatDate(hoy);
    }

    return { fechaInicioPeriodo, fechaFinPeriodo };
  };


  // Función auxiliar para obtener el rango de fechas según el filtro
  const obtenerRangoFechas = (filtro) => {
    const hoy = new Date();
    let fechaInicioFiltro, fechaFinFiltro;

    switch (filtro) {
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
        return null;
    }

    fechaInicioFiltro.setHours(0, 0, 0, 0);
    fechaFinFiltro.setHours(23, 59, 59, 999);

    return {
      inicio: fechaInicioFiltro.toISOString(),
      fin: fechaFinFiltro.toISOString()
    };
  };


  const agruparMovimientos = (movimientos, granularidad) => {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const grupos = {};

    movimientos.forEach((m) => {
      const fecha = new Date(m.fecha);
      let key, label, fechaInicio, fechaFin;

      if (granularidad === "dia") {
        key = fecha.toISOString().split("T")[0];
        label = `${diasSemana[fecha.getDay()]} ${fecha.getDate()} ${meses[fecha.getMonth()]}`;
        fechaInicio = key;
        fechaFin = key;

      } else if (granularidad === "semana") {
        const primerDiaAno = new Date(fecha.getFullYear(), 0, 1);
        const semanaNum = Math.ceil(((fecha - primerDiaAno) / 86400000 + primerDiaAno.getDay() + 1) / 7);
        key = `Semana ${semanaNum}`;

        fechaInicio = new Date(primerDiaAno.getTime() + (semanaNum - 1) * 7 * 86400000);
        fechaFin = new Date(fechaInicio.getTime() + 6 * 86400000);
        label = `${diasSemana[fechaInicio.getDay()]} ${fechaInicio.getDate()} ${meses[fechaInicio.getMonth()]} - ${diasSemana[fechaFin.getDay()]} ${fechaFin.getDate()} ${meses[fechaFin.getMonth()]}`;

        fechaInicio = fechaInicio.toISOString().split("T")[0];
        fechaFin = fechaFin.toISOString().split("T")[0];

      } else if (granularidad === "mes") {
        key = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, "0")}`;
        fechaInicio = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
        fechaFin = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
        label = meses[fecha.getMonth()];

        fechaInicio = fechaInicio.toISOString().split("T")[0];
        fechaFin = fechaFin.toISOString().split("T")[0];

      } else if (granularidad === "trimestre") {
        const trimestre = Math.floor(fecha.getMonth() / 3) + 1;
        key = `Q${trimestre} ${fecha.getFullYear()}`;
        const primerMes = (trimestre - 1) * 3;
        fechaInicio = new Date(fecha.getFullYear(), primerMes, 1);
        fechaFin = new Date(fecha.getFullYear(), primerMes + 3, 0);

        label = `${meses[primerMes]}-${meses[primerMes + 2]}`;

        fechaInicio = fechaInicio.toISOString().split("T")[0];
        fechaFin = fechaFin.toISOString().split("T")[0];
      }

      if (!grupos[key]) grupos[key] = { ingresos: 0, egresos: 0, label, fechaInicio, fechaFin };
      if (m.tipo === "ingreso") grupos[key].ingresos += Number(m.monto);
      else grupos[key].egresos += Number(m.monto);
    });

    return Object.values(grupos);
  };



  // Función base para cargar movimientos (reutilizable)
  const cargarMovimientosBase = async (filtrosAdicionales = {}, forzarFiltro = null) => {
    if (!user) return;

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
        .order('fecha', { ascending: false });

      // Aplicar filtros adicionales (como concepto_id)
      Object.keys(filtrosAdicionales).forEach(key => {
        query = query.eq(key, filtrosAdicionales[key]);
      });

      const filtroAAplicar = forzarFiltro !== null ? forzarFiltro : filtroTiempo;

      // Aplicar filtro de tiempo si no es "todos"
      if (filtroAAplicar !== 'todos') {
        const rangoFechas = obtenerRangoFechas(filtroAAplicar);

        if (rangoFechas) {
          console.log(`Filtro ${filtroAAplicar}: ${rangoFechas.inicio} a ${rangoFechas.fin}`);

          query = query
            .gte('fecha', rangoFechas.inicio)
            .lte('fecha', rangoFechas.fin);
        }
      }

      const { data: movimientos, error } = await query;

      if (error) throw error;

      console.log('Movimientos encontrados:', movimientos);
      setMovimientosConcepto(movimientos || []);

    } catch (error) {
      console.error("Error cargando movimientos:", error);
      setError("Error al cargar los movimientos: " + error.message);
    } finally {
      setCargandoMovimientos(false);
    }
  };

  // Función para cargar movimientos por concepto específico
  const cargarMovimientosPorConcepto = async (concepto, forzarFiltro = null) => {
    setConceptoSeleccionado(concepto);
    await cargarMovimientosBase({ concepto_id: concepto.id }, forzarFiltro);
  };

  // Función para cargar todos los movimientos
  const cargarTodosLosMovimientos = async (forzarFiltro = null) => {
    setConceptoSeleccionado(null);
    await cargarMovimientosBase({}, forzarFiltro);
  };
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
              <div className="conceptos-lista">
                <h3>Conceptos</h3>
                <div className="concepto-todos-container">
                  <button
                    className={`concepto-todos ${!conceptoSeleccionado ? 'seleccionado' : ''}`}
                    onClick={() => cargarTodosLosMovimientos()}
                  >
                    <strong>Todos los Conceptos</strong>
                  </button>
                </div>
                <ul>
                  {conceptos.map(concepto => (
                    <li
                      key={concepto.id}
                      className={conceptoSeleccionado?.id === concepto.id ? 'seleccionado' : ''}
                      onClick={() => cargarMovimientosPorConcepto(concepto)}
                    >
                      <strong>{concepto.nombre}</strong>
                      <span className="tipo-concepto">
                        ({concepto.tipo === 'egreso' ? 'Egreso' : 'Ingreso'})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

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

                    {filtroTiempo !== 'todos' && (
                      <span className="rango-fechas-info">
                        {obtenerTextoRangoFechas(filtroTiempo)}
                      </span>
                    )}
                  </div>
                </div>

                {cargandoMovimientos ? (
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
                            <th style={{ textAlign: 'center' }}>Comentario</th>
                            <th style={{ textAlign: 'center' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientosConcepto.map(movimiento => (
                            <tr key={movimiento.id}>
                              <td>{movimiento.usuarios?.nombre || 'Usuario'}</td>
                              <td>{movimiento.fecha}</td>
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
                              <td>
                                <div className="celda-comentario">
                                  {movimiento.comentario ? (
                                    <FaEye
                                      className="icono-comentario"
                                      onClick={() => setComentarioSeleccionado(movimiento.comentario)}
                                      title="Ver comentario completo"
                                    />
                                  ) : (
                                    'Sin comentario'
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="celda-comentario">
                                  <button
                                    className="btn-editar"
                                    title="Editar movimiento"
                                    onClick={() => abrirModalEdicion(movimiento)}
                                  >
                                    <FaEdit size={14} />
                                  </button>
                                </div>
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

      {modalEdicionAbierto && movimientoEditando && (
        <div className="modal-edicion-overlay" onClick={cerrarModalEdicion}>
          <div className="modal-edicion" onClick={(e) => e.stopPropagation()}>
            <div className="modal-edicion-header">
              <h3>Editar Movimiento</h3>
              <button
                className="cerrar-modal"
                onClick={cerrarModalEdicion}
              >
                ×
              </button>
            </div>

            <div className="modal-edicion-content">
              <div className="form-group">
                <label>Monto:</label>
                <input
                  type="number"
                  value={movimientoEditando.monto}
                  onChange={(e) => setMovimientoEditando({
                    ...movimientoEditando,
                    monto: parseFloat(e.target.value)
                  })}
                  className="input-edicion"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Fecha:</label>
                <input
                  type="date"
                  value={movimientoEditando.fecha}
                  onChange={(e) => setMovimientoEditando({
                    ...movimientoEditando,
                    fecha: e.target.value
                  })}
                  className="input-edicion"
                />
              </div>

              <div className="form-group">
                <label>Comentario:</label>
                <textarea
                  value={movimientoEditando.comentario || ''}
                  onChange={(e) => setMovimientoEditando({
                    ...movimientoEditando,
                    comentario: e.target.value
                  })}
                  className="textarea-edicion"
                  rows="4"
                  placeholder="Agregar comentario..."
                />
              </div>
            </div>

            <div className="modal-edicion-footer">
              <button
                className="btn-cancelar"
                onClick={cerrarModalEdicion}
                disabled={guardandoCambios}
              >
                Cancelar
              </button>
              <button
                className="btn-guardar"
                onClick={guardarMovimientoEditado}
                disabled={guardandoCambios}
              >
                {guardandoCambios ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {comentarioSeleccionado && (
        <div className="modal-comentario-overlay" onClick={() => setComentarioSeleccionado(null)}>
          <div className="modal-comentario" onClick={(e) => e.stopPropagation()}>
            <div className="modal-comentario-header">
              <h3>Comentario Completo</h3>
              <button
                className="cerrar-modal"
                onClick={() => setComentarioSeleccionado(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-comentario-content">
              <p>{comentarioSeleccionado}</p>
            </div>
            <div className="modal-comentario-footer">
              <button
                className="btn-cerrar-modal"
                onClick={() => setComentarioSeleccionado(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}


      {modalBalanceAbierto && balanceData && balanceData.resumen && (() => {
        const parseFecha = (fechaStr) => {
          if (!fechaStr) return null;
          const [year, month, day] = fechaStr.split("-");
          return new Date(year, month - 1, day); // mes 0-11 en JS
        };

        // const fechaInicioObj = parseFecha(balanceData.fechas.inicio);
        // const fechaFinObj = parseFecha(balanceData.fechas.fin);
        const fechaInicioObj = parseFecha(fechaInicio);
        const fechaFinObj = parseFecha(fechaFin);

        console.log("fecha inicio general: ", fechaInicio);
        console.log("fecha fin en general: ", fechaFin);
        console.log("fecha inicio de balance data: ", balanceData.fechas.inicio);
        console.log("fecha fin de balance data: ", balanceData.fechas.fin);
        console.log("fecha inicio: ", fechaInicioObj);
        console.log("fecha fin: ", fechaFinObj);

        const dias = Math.ceil((fechaFinObj - fechaInicioObj) / (1000 * 60 * 60 * 24)) + 1;

        console.log("Dias calculados: ", dias);

        let granularidad;
        if (dias <= 7) granularidad = "dia";
        else if (dias <= 35) granularidad = "semana";
        else if (dias <= 120) granularidad = "mes";
        else granularidad = "trimestre";
        console.log("Granularidad: ", granularidad);

        const graficoData = agruparMovimientos(balanceData.movimientos, granularidad);

        return (
          <div className="panel-movimientos-overlay" onClick={() => setModalBalanceAbierto(false)}>
            <div className="panel-movimientos" onClick={(e) => e.stopPropagation()}>
              <div className="panel-header">
                <h2>Resumen de Ganancias</h2>
                <button
                  className="cerrar-panel"
                  onClick={() => setModalBalanceAbierto(false)}
                >
                  ×
                </button>
              </div>

              <div className="panel-contenido">
                <div className="balance-resumen-content">
                  {/* <div className="conceptos-resumen">
                    {balanceData.resumen.conceptos.map((concepto, index) => (
                      <div key={concepto.id || index} className="concepto-item">
                        <h3 className="concepto-nombre">{concepto.nombre}</h3>
                        <div className="concepto-detalles">
                          {concepto.ingresos > 0 && (
                            <div className="concepto-linea">
                              <span>Ingresos</span>
                              <span className="monto-positivo">{formatCurrency(concepto.ingresos)}</span>
                            </div>
                          )}
                          {concepto.egresos > 0 && (
                            <div className="concepto-linea">
                              <span>Egresos</span>
                              <span className="monto-negativo">{formatCurrency(concepto.egresos)}</span>
                            </div>
                          )}
                          <div className="concepto-fechas">
                            {concepto.fechas.slice(0, 3).map((fecha, i) => (
                              <span key={i} className="fecha-item">{fecha}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div> */}

                  <div className="totales-grid">
                    <div className="resumen-totales ingresos">
                      <div className="total-linea">
                        <span className="total-label">TOTAL INGRESOS:</span>
                        <span className="total-monto-positivo">{formatCurrency(balanceData.resumen.totalIngresos)}</span>
                      </div>
                    </div>
                    <div className="resumen-totales egresos">
                      <div className="total-linea">
                        <span className="total-label">TOTAL EGRESOS:</span>
                        <span className="total-monto-negativo">{formatCurrency(balanceData.resumen.totalEgresos)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="resumen-tendencias">
                    <h3 className="tendencias-titulo">Tendencias:</h3>
                    <div className="tendencias-content">
                      <span className={`tendencia ${balanceData.resumen.tendencia.toLowerCase()}`}>
                        {balanceData.resumen.tendencia}
                      </span>
                      <div className="ahorro-linea">
                        <span>Ahorro</span>
                        <span className={`ahorro-monto ${balanceData.resumen.ahorro >= 0 ? 'positivo' : 'negativo'}`}>
                          {formatCurrency(balanceData.resumen.ahorro)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ width: "100%", height: 300, minHeight: 300, marginTop: "20px" }}>
                    <BalanceChart data={graficoData} />
                  </div>

                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="balance__header">
        <h1>Balance</h1>
      </div>

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
              <label>Selecciona el período</label>
              <select
                value={periodo}
                className="select-filtro"
                onChange={(e) => {
                  const value = e.target.value;
                  setPeriodo(value);

                  const hoy = new Date();
                  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()); // hora 00:00

                  let inicio = null;
                  let fin = hoyLocal;

                  switch (value) {
                    case "hoy":
                      inicio = new Date(hoyLocal);
                      break;

                    case "7dias":
                      inicio = new Date(hoyLocal);
                      inicio.setDate(hoyLocal.getDate() - 6);
                      break;

                    case "30dias":
                      inicio = new Date(hoyLocal);
                      inicio.setDate(hoyLocal.getDate() - 29);
                      break;

                    case "mes_actual":
                      inicio = new Date(hoyLocal.getFullYear(), hoyLocal.getMonth(), 1);
                      break;

                    case "año_actual":
                      inicio = new Date(hoyLocal.getFullYear(), 0, 1);
                      break;

                    case "personalizado":
                      return;
                  }


                  setFechaInicio(inicio.toISOString().split("T")[0]);
                  setFechaFin(fin.toISOString().split("T")[0]);
                }}
              >
                <option value="hoy">Hoy</option>
                <option value="7dias">Últimos 7 días</option>
                <option value="30dias">Últimos 30 días</option>
                <option value="mes_actual">Mes actual</option>
                <option value="año_actual">Año actual</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
            {periodo === "personalizado" && (
              <>
                <div className="fechas-group">
                  <div className="fecha-input-group">
                    <label>Fecha de Inicio</label>
                    <div className="fecha-input-container">
                      <input
                        type="date"
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
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="fecha-input"
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
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