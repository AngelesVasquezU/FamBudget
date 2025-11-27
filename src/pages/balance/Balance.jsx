/**
 * VIEW-005 — Balance.jsx 
 * -------------------------------------------------------------
 * Vista encargada de mostrar el balance financiero del usuario.
 *
 * Funcionalidades principales:
 * - Resumen mensual (ingresos, egresos y balance).
 * - Visualización de los conceptos más usados.
 * - Panel lateral para revisar movimientos por concepto o periodo.
 * - Edición de movimientos mediante modal.
 * - Generación de balances personalizados y familiares.
 *
 * Gestores utilizados:
 * - GestorUsuario
 * - GestorMovimientos
 * - GestorConceptos
 *
 */

import { useEffect, useState } from "react";
import { providers } from "../../services/providers";
import { FaEdit, FaEye } from 'react-icons/fa';
import BalanceChart from "../../pages/balance/BalanceChart";
import "../../styles/Balance.css";

/**
 * Formatea un número como moneda peruana (PEN)
 * @param {number} amount - Monto a formatear
 * @returns {string} Monto formateado (ej: "S/ 1,234.56")
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(amount);
};

const { gestorUsuario, gestorMovimientos, gestorConceptos } = providers;

/**
 * Balance Component
 * Componente principal de gestión de balances financieros
 */
const Balance = () => {
  // ESTADOS DEL COMPONENTE

  // Estados de carga y error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generandoBalance, setGenerandoBalance] = useState(false);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [guardandoCambios, setGuardandoCambios] = useState(false);

  // Estados de datos principales
  const [user, setUser] = useState(null);
  const [conceptos, setConceptos] = useState([]);
  const [topEgresos, setTopEgresos] = useState([]);
  const [topIngresos, setTopIngresos] = useState([]);
  const [totalEgresos, setTotalEgresos] = useState(0);
  const [totalIngresos, setTotalIngresos] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [movimientosConcepto, setMovimientosConcepto] = useState([]);
  const [balanceData, setBalanceData] = useState(null);

  // Estados de UI y modales
  const [panelMovimientosAbierto, setPanelMovimientosAbierto] = useState(false);
  const [modalBalanceAbierto, setModalBalanceAbierto] = useState(false);
  const [modalEdicionAbierto, setModalEdicionAbierto] = useState(false);
  const [comentarioSeleccionado, setComentarioSeleccionado] = useState(null);
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState(null);

  // Estados de filtros y parámetros
  const [periodo, setPeriodo] = useState('');
  const [tipoBalance, setTipoBalance] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroTiempo, setFiltroTiempo] = useState('todos');

  // Estados de edición
  const [movimientoEditando, setMovimientoEditando] = useState(null);

  // EFECTOS Y CARGA INICIAL
  /**
   * Efecto de inicialización del componente
   * Se ejecuta una vez al montar el componente
   * Carga el usuario y el resumen financiero inicial
   */
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("Obteniendo usuario...");
        const usuario = await gestorUsuario.obtenerUsuario();

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

  // FUNCIONES DE CARGA DE DATOS
  /**
   * MVIEW005-1
   * Carga el resumen financiero del usuario usando solo gestores
   * @param {string} userId - ID del usuario
   */
  const cargarResumen = async (userId) => {
    try {
      console.log("Cargando resumen para usuario:", userId);

      const hoy = new Date();
      const mes = hoy.getMonth() + 1;
      const año = hoy.getFullYear();

      // Obtener totales usando métodos del gestor
      const ingresosTotales = await gestorMovimientos.obtenerTotalPorTipo(userId, "ingreso", { mes, año });
      const egresosTotales = await gestorMovimientos.obtenerTotalPorTipo(userId, "egreso", { mes, año });

      console.log("Ingresos totales:", ingresosTotales);
      console.log("Egresos totales:", egresosTotales);

      setTotalEgresos(egresosTotales || 0);
      setTotalIngresos(ingresosTotales || 0);

      const balanceTotal = Math.round((ingresosTotales - egresosTotales)* 100) / 100;

      setTotalBalance(balanceTotal || 0);

      const resumen = await gestorMovimientos.calcularResumenConceptos(userId, { mes, año });

      console.log("Top 3 egresos:", resumen.topEgresos);
      console.log("Top 3 ingresos:", resumen.topIngresos);

      setTopEgresos(resumen.topEgresos);
      setTopIngresos(resumen.topIngresos);

    } catch (error) {
      console.error('Error cargando resumen:', error);
      setError("Error al cargar el resumen: " + error.message);
    }
  };

  // FUNCIONES DEL PANEL DE MOVIMIENTOS

  /**
   * MVIEW005-2
   * Abre el panel lateral de movimientos y carga datos iniciales
   * Carga la lista completa de conceptos y todos los movimientos
   */
  const abrirPanelMovimientos = async () => {
    if (!user) {
      setError("Usuario no disponible");
      return;
    }

    setPanelMovimientosAbierto(true);
    setCargandoMovimientos(true);

    try {
      // Cargar lista completa de conceptos usando gestor
      const todosConceptos = await gestorConceptos.obtenerConceptos();
      setConceptos(todosConceptos || []);

      await cargarTodosLosMovimientos();

    } catch (error) {
      console.error("Error cargando panel de movimientos:", error);
      setError("Error al cargar los movimientos");
    } finally {
      setCargandoMovimientos(false);
    }
  };

  /**
   * MVIEW005-3
   * Maneja el cambio de filtro temporal y recarga los movimientos
   * @param {string} nuevoFiltro - Nuevo filtro a aplicar ('todos', 'dia', 'semana', 'quincena', 'mes')
   */
  const manejarCambioFiltro = async (nuevoFiltro) => {
    setFiltroTiempo(nuevoFiltro);

    if (conceptoSeleccionado) {
      await cargarMovimientosPorConcepto(conceptoSeleccionado, nuevoFiltro);
    } else {
      await cargarTodosLosMovimientos(nuevoFiltro);
    }
  };

  // FUNCIONES DE EDICIÓN DE MOVIMIENTOS

  /**
   * MVIEW005-4
   * Abre el modal de edición con el movimiento seleccionado
   * @param {Object} movimiento - Movimiento a editar
   */
  const abrirModalEdicion = (movimiento) => {
    setMovimientoEditando(movimiento);
    setModalEdicionAbierto(true);
  };

  /**
   * MVIEW005-5
   * Cierra el modal de edición y limpia el estado
   */
  const cerrarModalEdicion = () => {
    setModalEdicionAbierto(false);
    setMovimientoEditando(null);
  };

  /**
   * MVIEW005-6
   * Guarda los cambios realizados en un movimiento usando el gestor
   * Actualiza el estado local y muestra confirmación
   */
  const guardarMovimientoEditado = async () => {
    if (!movimientoEditando) return;

    setGuardandoCambios(true);

    try {
      console.log("Actualizando movimiento:", movimientoEditando);

      const movimientoActualizado = await gestorMovimientos.actualizarMovimiento(
        movimientoEditando.id,
        {
          monto: movimientoEditando.monto,
          fecha: movimientoEditando.fecha,
          comentario: movimientoEditando.comentario
        }
      );

      console.log("Movimiento actualizado:", movimientoActualizado);

      setMovimientosConcepto(prev =>
        prev.map(mov =>
          mov.id === movimientoEditando.id ? movimientoEditando : mov
        )
      );

      cerrarModalEdicion();
      alert('Movimiento actualizado correctamente');

    } catch (error) {
      console.error('Error al actualizar movimiento:', error);
      setError('Error al actualizar el movimiento: ' + error.message);
    } finally {
      setGuardandoCambios(false);
    }
  };

  // FUNCIONES DE GENERACIÓN DE BALANCE

  /**
   * MVIEW005-7
   * Genera un balance financiero basado en los parámetros seleccionados
   * Procesa movimientos, agrupa por concepto y calcula totales
   * Abre modal con resultados visualizados en gráfico
   */
  const generarBalance = async () => {
    if (!user) {
      setError("Usuario no disponible");
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

      if (periodo === 'personalizado') {
        if (!fechaInicio || !fechaFin) {
          alert("Por favor ingresa fechas válidas para el balance personalizado.");
          setGenerandoBalance(false);
          return;
        }

        const convertirFecha = (fechaStr) => {
          if (!fechaStr) return null;
          if (fechaStr.includes('-')) {
            const [yyyy, mm, dd] = fechaStr.split('-').map(Number);
            return new Date(yyyy, mm - 1, dd);
          }
          if (fechaStr.includes('/')) {
            const [dd, mm, yyyy] = fechaStr.split('/').map(Number);
            return new Date(yyyy, mm - 1, dd);
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

        const formatDateToISO = (dateObj) => dateObj.toISOString().split('T')[0];
        fechaInicioPeriodo = formatDateToISO(fechaInicioPeriodo);
        fechaFinPeriodo = formatDateToISO(fechaFinPeriodo);

      } else {
        ({ fechaInicioPeriodo, fechaFinPeriodo } = calcularRangoPorPeriodo(periodo, fechaInicio, fechaFin));
      }

      const balance = await gestorMovimientos.obtenerBalanceEntreFechas({
        fechaInicio: fechaInicioPeriodo,
        fechaFin: fechaFinPeriodo,
        tipo: tipoBalance,
        usuarioId: userId
      });

      // Procesamiento de movimientos por concepto
      const conceptosMap = {};
      balance.movimientos.forEach(m => {
        const conceptoId = m.concepto_id || m.id;
        const nombre = m.conceptos?.nombre || m.concepto || 'Sin concepto';
        const tipo = m.conceptos?.tipo || m.tipo;
        const monto = Number(m.monto);
        const fecha = m.fecha?.split('T')[0];

        if (!conceptosMap[conceptoId]) {
          conceptosMap[conceptoId] = {
            id: conceptoId,
            nombre,
            tipo,
            ingresos: 0,
            egresos: 0,
            fechas: []
          };
        }

        if (tipo === 'ingreso') conceptosMap[conceptoId].ingresos += monto;
        else if (tipo === 'egreso') conceptosMap[conceptoId].egresos += monto;

        if (fecha && !conceptosMap[conceptoId].fechas.includes(fecha)) {
          conceptosMap[conceptoId].fechas.push(fecha);
        }
      });

      const usuariosMap = {};
      const totalFamiliarEgresos = balance.totales.egresos || 0;

      balance.movimientos.forEach(m => {
        const usuario = m.usuarios?.nombre || "Desconocido";
        const monto = Number(m.monto);
        const tipo = m.tipo;
        const concepto = m.conceptos?.nombre || "Sin concepto";

        if (!usuariosMap[usuario]) {
          usuariosMap[usuario] = {
            nombre: usuario,
            ingresos: 0,
            egresos: 0,
            total: 0,
            movimientos: [],
            topConcepto: {},     // almacenamos sumatoria por concepto
            participacion: 0,     // % del total familiar
            topConceptoNombre: "",
            topConceptoMonto: 0
          };
        }

        if (tipo === "ingreso") usuariosMap[usuario].ingresos += monto;
        else usuariosMap[usuario].egresos += monto;

        usuariosMap[usuario].movimientos.push(m);

        if (tipo === "egreso") {
          if (!usuariosMap[usuario].topConcepto[concepto]) {
            usuariosMap[usuario].topConcepto[concepto] = 0;
          }
          usuariosMap[usuario].topConcepto[concepto] += monto;
        }
      });

      Object.keys(usuariosMap).forEach(usuario => {
        const u = usuariosMap[usuario];
        u.total = u.ingresos - u.egresos;
        u.participacion = totalFamiliarEgresos
          ? (u.egresos / totalFamiliarEgresos) * 100
          : 0;

        const conceptosOrdenados = Object.entries(u.topConcepto)
          .sort((a, b) => b[1] - a[1]);

        if (conceptosOrdenados.length > 0) {
          u.topConceptoNombre = conceptosOrdenados[0][0];
          u.topConceptoMonto = conceptosOrdenados[0][1];
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
        },
        usuarios: Object.values(usuariosMap)
      });

      setModalBalanceAbierto(true);

    } catch (error) {
      console.error('Error generando balance:', error);
      setError('Error al generar el balance: ' + error.message);
    } finally {
      setGenerandoBalance(false);
    }
  };

  // FUNCIONES DE CÁLCULO DE FECHAS

  /**
   * MVIEW005-8
   * Calcula el rango de fechas según el periodo seleccionado
   * @param {string} periodo - Tipo de periodo ('hoy', '7dias', '30dias', 'mes_actual', 'año_actual', 'personalizado')
   * @returns {Object} Objeto con fechaInicioPeriodo y fechaFinPeriodo en formato ISO
   */
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

  /**
   * MVIEW005-9
   * Obtiene el rango de fechas según el filtro temporal seleccionado
   * @param {string} filtro - Tipo de filtro ('dia', 'semana', 'quincena', 'mes')
   * @returns {Object|null} Objeto con inicio y fin en formato ISO, o null si filtro es 'todos'
   */
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

  // FUNCIONES DE AGRUPACIÓN DE MOVIMIENTOS

  /**
   * MVIEW005-10
   * Agrupa movimientos según la granularidad especificada (día, semana, mes, trimestre)
   * Genera todos los períodos del rango aunque no tengan movimientos
   * @param {Array} movimientos - Lista de movimientos a agrupar
   * @param {string} granularidad - Nivel de agrupación ('dia', 'semana', 'mes', 'trimestre')
   * @param {Date} fechaInicioObj - Fecha de inicio del rango
   * @param {Date} fechaFinObj - Fecha de fin del rango
   * @returns {Array} Array de objetos con ingresos, egresos y labels por período
   */
  const agruparMovimientos = (movimientos, granularidad, fechaInicioObj, fechaFinObj) => {
    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const grupos = {};

    /**
     * Calcula el inicio de la semana (domingo) para una fecha dada
     */
    const obtenerInicioSemana = (fecha) => {
      const d = new Date(fecha);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    };

    /**
     * Calcula el fin de la semana dado el inicio
     */
    const obtenerFinSemana = (inicioSemana) => {
      const d = new Date(inicioSemana);
      d.setDate(d.getDate() + 6);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    /**
     * Genera clave única para una semana, ajustada al rango de fechas
     */
    const generarClaveSemana = (fecha) => {
      let inicioSemana = obtenerInicioSemana(fecha);
      let finSemana = obtenerFinSemana(inicioSemana);

      if (inicioSemana < fechaInicioObj) {
        inicioSemana = new Date(fechaInicioObj);
      }
      if (finSemana > fechaFinObj) {
        finSemana = new Date(fechaFinObj);
      }

      return `${inicioSemana.toISOString().split("T")[0]}_${finSemana.toISOString().split("T")[0]}`;
    };

    /**
     * Genera grupos vacíos para cada día del rango
     */
    const generarDias = () => {
      let current = new Date(fechaInicioObj);
      while (current <= fechaFinObj) {
        const start = new Date(current);
        const key = start.toISOString().split("T")[0];
        const label = `${diasSemana[start.getDay()]} ${start.getDate()} ${meses[start.getMonth()]}`;
        grupos[key] = { ingresos: 0, egresos: 0, label, fechaInicio: key, fechaFin: key };
        current.setDate(current.getDate() + 1);
      }
    };

    /**
     * Genera grupos vacíos para cada semana del rango
     */
    const generarSemanas = () => {
      let current = obtenerInicioSemana(fechaInicioObj);

      while (current <= fechaFinObj) {
        let start = new Date(current);
        let end = obtenerFinSemana(start);

        if (start < fechaInicioObj) start = new Date(fechaInicioObj);
        if (end > fechaFinObj) end = new Date(fechaFinObj);

        const key = `${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}`;
        const label = `${diasSemana[start.getDay()]} ${start.getDate()} ${meses[start.getMonth()]} - ${diasSemana[end.getDay()]} ${end.getDate()} ${meses[end.getMonth()]}`;
        grupos[key] = {
          ingresos: 0,
          egresos: 0,
          label,
          fechaInicio: start.toISOString().split("T")[0],
          fechaFin: end.toISOString().split("T")[0]
        };

        current.setDate(current.getDate() + 7);
      }
    };

    /**
     * Genera grupos vacíos para cada mes del rango
     */
    const generarMeses = () => {
      let current = new Date(fechaInicioObj.getFullYear(), fechaInicioObj.getMonth(), 1);
      const finMes = new Date(fechaFinObj.getFullYear(), fechaFinObj.getMonth(), 1);

      while (current <= finMes) {
        const start = new Date(current.getFullYear(), current.getMonth(), 1);
        const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);

        let startRecortado = start < fechaInicioObj ? new Date(fechaInicioObj) : new Date(start);
        let endRecortado = end > fechaFinObj ? new Date(fechaFinObj) : new Date(end);

        const key = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, "0")}`;
        const label = meses[start.getMonth()];
        grupos[key] = {
          ingresos: 0,
          egresos: 0,
          label,
          fechaInicio: startRecortado.toISOString().split("T")[0],
          fechaFin: endRecortado.toISOString().split("T")[0]
        };

        current.setMonth(current.getMonth() + 1);
      }
    };

    /**
     * Genera grupos vacíos para cada trimestre del rango
     */
    const generarTrimestres = () => {
      let current = new Date(fechaInicioObj.getFullYear(), Math.floor(fechaInicioObj.getMonth() / 3) * 3, 1);
      const finTrim = new Date(fechaFinObj.getFullYear(), Math.floor(fechaFinObj.getMonth() / 3) * 3, 1);

      while (current <= finTrim) {
        const start = new Date(current.getFullYear(), current.getMonth(), 1);
        const end = new Date(current.getFullYear(), current.getMonth() + 3, 0);

        let startRecortado = start < fechaInicioObj ? new Date(fechaInicioObj) : new Date(start);
        let endRecortado = end > fechaFinObj ? new Date(fechaFinObj) : new Date(end);

        const trimestre = Math.floor(start.getMonth() / 3) + 1;
        const key = `Q${trimestre}_${start.getFullYear()}`;
        const label = `${meses[start.getMonth()]} - ${meses[end.getMonth()]}`;
        grupos[key] = {
          ingresos: 0,
          egresos: 0,
          label,
          fechaInicio: startRecortado.toISOString().split("T")[0],
          fechaFin: endRecortado.toISOString().split("T")[0]
        };

        current.setMonth(current.getMonth() + 3);
      }
    };

    // Generar estructura de grupos según granularidad
    if (granularidad === "dia") generarDias();
    else if (granularidad === "semana") generarSemanas();
    else if (granularidad === "mes") generarMeses();
    else if (granularidad === "trimestre") generarTrimestres();

    // Asignar movimientos a sus grupos correspondientes
    movimientos.forEach(m => {
      const fecha = new Date(m.fecha);
      let key;

      // Generar clave según granularidad
      if (granularidad === "dia") {
        key = fecha.toISOString().split("T")[0];
      } else if (granularidad === "semana") {
        key = generarClaveSemana(fecha);
      } else if (granularidad === "mes") {
        key = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, "0")}`;
      } else if (granularidad === "trimestre") {
        const trimestre = Math.floor(fecha.getMonth() / 3) + 1;
        key = `Q${trimestre}_${fecha.getFullYear()}`;
      }

      if (!grupos[key]) {
        console.warn(`Clave no encontrada: ${key} para fecha ${m.fecha}`);
        return;
      }

      // Acumular montos según tipo
      if (m.tipo === "ingreso") grupos[key].ingresos += Number(m.monto);
      else grupos[key].egresos += Number(m.monto);
    });

    return Object.values(grupos);
  };

  // FUNCIONES DE CARGA DE MOVIMIENTOS CON FILTROS

  /**
   * MVIEW005-11
   * Función base para cargar movimientos con filtros usando el gestor
   * @param {Object} filtrosAdicionales - Filtros específicos (ej: {concepto_id: 123})
   * @param {string|null} forzarFiltro - Filtro temporal a forzar
   */
  const cargarMovimientosBase = async (filtrosAdicionales = {}, forzarFiltro = null) => {
    if (!user) return;

    setCargandoMovimientos(true);

    try {
      // Obtener usuarios de la familia
      const usuariosFamilia = await gestorUsuario.obtenerUsuariosDeMiFamilia();
      const idsFamilia = usuariosFamilia.map(u => u.id);

      // Determinar filtro temporal
      const filtroAAplicar = forzarFiltro !== null ? forzarFiltro : filtroTiempo;

      const opciones = {
        usuariosIds: idsFamilia,
        ordenar: 'desc'
      };

      // Aplicar filtro por concepto si existe
      if (filtrosAdicionales.concepto_id) {
        opciones.conceptoId = filtrosAdicionales.concepto_id;
      }

      // Aplicar filtro temporal si no es "todos"
      if (filtroAAplicar !== 'todos') {
        const rangoFechas = obtenerRangoFechas(filtroAAplicar);

        if (rangoFechas) {
          console.log(`Filtro ${filtroAAplicar}: ${rangoFechas.inicio} a ${rangoFechas.fin}`);
          opciones.fechaInicio = rangoFechas.inicio;
          opciones.fechaFin = rangoFechas.fin;
        }
      }

      const movimientos = await gestorMovimientos.obtenerMovimientosFiltrados(opciones);

      console.log('Movimientos encontrados:', movimientos);
      setMovimientosConcepto(movimientos || []);

    } catch (error) {
      console.error("Error cargando movimientos:", error);
      setError("Error al cargar los movimientos: " + error.message);
    } finally {
      setCargandoMovimientos(false);
    }
  };

  /**
   * MVIEW005-12
   * Carga movimientos filtrados por concepto específico
   * @param {Object} concepto - Concepto por el cual filtrar
   * @param {string|null} forzarFiltro - Filtro temporal opcional a forzar
   */
  const cargarMovimientosPorConcepto = async (concepto, forzarFiltro = null) => {
    setConceptoSeleccionado(concepto);
    await cargarMovimientosBase({ concepto_id: concepto.id }, forzarFiltro);
  };

  /**
   * MVIEW005-13
   * Carga todos los movimientos sin filtrar por concepto
   * @param {string|null} forzarFiltro - Filtro temporal opcional a forzar
   */
  const cargarTodosLosMovimientos = async (forzarFiltro = null) => {
    setConceptoSeleccionado(null);
    await cargarMovimientosBase({}, forzarFiltro);
  };

  // FUNCIONES DE UTILIDAD Y FORMATEO

  /**
   * MVIEW005-14
   * Genera texto descriptivo del rango de fechas según el filtro
   * @param {string} filtro - Tipo de filtro ('dia', 'semana', 'quincena', 'mes')
   * @returns {string} Descripción del rango de fechas en formato legible
   */
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

  // RENDERIZADO DEL COMPONENTE
  
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
                <h2>Movimientos registrados</h2>
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
  
          const fechaInicioObj = parseFecha(fechaInicio);
          const fechaFinObj = parseFecha(fechaFin);
  
          const dias = Math.ceil((fechaFinObj - fechaInicioObj) / (1000 * 60 * 60 * 24)) + 1;
  
          let granularidad;
          if (dias <= 7) granularidad = "dia";
          else if (dias <= 35) granularidad = "semana";
          else if (dias <= 120) granularidad = "mes";
          else granularidad = "trimestre";
  
          const graficoData = agruparMovimientos(balanceData.movimientos, granularidad, fechaInicioObj, fechaFinObj);
  
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
                          <span>Balance</span>
                          <span className={`ahorro-monto ${balanceData.resumen.ahorro >= 0 ? 'positivo' : 'negativo'}`}>
                            {formatCurrency(balanceData.resumen.ahorro)}
                          </span>
                        </div>
                      </div>
                    </div>
  
                    <div style={{ width: "100%", height: 300, minHeight: 300, marginTop: "20px" }}>
                      <BalanceChart data={graficoData} />
                    </div>
  
                    {tipoBalance === "familiar" && balanceData.usuarios && (
                      <div className="detalle-por-persona">
                        <h2 style={{ marginTop: "30px" }}>Resumen por Persona</h2>

                        <table className="tabla-personas">
                          <thead>
                            <tr>
                              <th>Persona</th>
                              <th>Ingresos</th>
                              <th>Egresos</th>
                              <th>Balance</th>
                              <th>% Gastos</th>
                              <th>Concepto más gastado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {balanceData.usuarios.map((u) => (
                              <tr key={u.nombre}>
                                <td>{u.nombre}</td>
                                <td className="positivo">{formatCurrency(u.ingresos)}</td>
                                <td className="negativo">{formatCurrency(u.egresos)}</td>
                                <td className={u.total >= 0 ? "positivo" : "negativo"}>
                                  {formatCurrency(u.total)}
                                </td>
                                <td>{u.participacion.toFixed(1)}%</td>
                                <td>
                                  {u.topConceptoNombre
                                    ? `${u.topConceptoNombre} (${formatCurrency(u.topConceptoMonto)})`
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
            <h2>Resumen Mensual</h2>
  
            <div className="conceptos-grid">
              <div className="conceptos-columna">
                <h3>Ingresos : {formatCurrency(totalIngresos)}</h3>
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
              <div className="conceptos-columna">
                <h3>Egresos : {formatCurrency(totalEgresos)}</h3>
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
            </div>
  
            <div className="container-actions">
              <button
                className="btn-ver-movimientos"
                onClick={abrirPanelMovimientos}
              >
                Ver Movimientos
              </button>
              <div className="resumen-totales">
                <div className="total-item">
                  <span>Total Balance:</span>
                  <span className="total-monto">{formatCurrency(totalBalance)}</span>
                </div>
              </div>
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
                    console.log("Período seleccionado:", value);
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
                  <option value="">Seleccionar</option>
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