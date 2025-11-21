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

const Balance = () => { // VIEW-005
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

  const [panelMovimientosAbierto, setPanelMovimientosAbierto] = useState(false);
  const [conceptos, setConceptos] = useState([]);
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState(null);
  const [movimientosConcepto, setMovimientosConcepto] = useState([]);
  const [filtroTiempo, setFiltroTiempo] = useState('todos');
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [comentarioSeleccionado, setComentarioSeleccionado] = useState(null);
  const [modalBalanceAbierto, setModalBalanceAbierto] = useState(false);

  // Estados para el modal de edición
  const [movimientoEditando, setMovimientoEditando] = useState(null);
  const [modalEdicionAbierto, setModalEdicionAbierto] = useState(false);
  const [guardandoCambios, setGuardandoCambios] = useState(false);

  // Carga los datos iniciales del balance al montar el componente.
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

  // Cargar datos iniciales
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

  // MVIEW005-1
  // Carga el resumen de ingresos, egresos y top conceptos para el usuario.
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

  // MVIEW005-2
  // Abre el panel lateral de movimientos y carga los datos iniciales.
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

  // MVIEW005-3
  // Carga todos los movimientos del usuario con el filtro de tiempo seleccionado.
  const manejarCambioFiltro = async (nuevoFiltro) => {
    setFiltroTiempo(nuevoFiltro);

    if (conceptoSeleccionado) {
      await cargarMovimientosPorConcepto(conceptoSeleccionado, nuevoFiltro);
    } else {
      await cargarTodosLosMovimientos(nuevoFiltro);
    }
  };

  // MVIEW005-4
  // Carga todos los movimientos del usuario con el filtro de tiempo dado.
  const abrirModalEdicion = (movimiento) => {
    setMovimientoEditando(movimiento);
    setModalEdicionAbierto(true);
  };

  // MVIEW005-5
  // Cierra el modal de edición de movimiento.
  const cerrarModalEdicion = () => {
    setModalEdicionAbierto(false);
    setMovimientoEditando(null);
  };

  // MVIEW005-6
  // Guarda los cambios realizados en un movimiento editado.
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
        })
        .eq('id', movimientoEditando.id);

      if (error) throw error;

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

  // MVIEW005-7
  // Genera el balance según el tipo y periodo seleccionados.
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

  //MVIEW005-8
  // Calcula el rango de fechas según el periodo seleccionado.
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

  // MVIEW005-9
  // Obtiene el rango de fechas según el filtro de tiempo seleccionado.
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

  // MVIEW005-10
  // Agrupa movimientos según la granularidad y rango de fechas.
  const agruparMovimientos = (movimientos, granularidad, fechaInicioObj, fechaFinObj) => {
    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const grupos = {};

    const obtenerInicioSemana = (fecha) => {
      const d = new Date(fecha);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const obtenerFinSemana = (inicioSemana) => {
      const d = new Date(inicioSemana);
      d.setDate(d.getDate() + 6);
      d.setHours(23, 59, 59, 999);
      return d;
    };

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

    if (granularidad === "dia") generarDias();
    else if (granularidad === "semana") generarSemanas();
    else if (granularidad === "mes") generarMeses();
    else if (granularidad === "trimestre") generarTrimestres();

    movimientos.forEach(m => {
      const fecha = new Date(m.fecha);
      let key;

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

      if (m.tipo === "ingreso") grupos[key].ingresos += Number(m.monto);
      else grupos[key].egresos += Number(m.monto);
    });

    return Object.values(grupos);
  };

  // MVIEW005-11
  // Función base para cargar movimientos con filtros y manejo de errores.
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

  // MVIEW005-12
  // Función para cargar movimientos por concepto seleccionado
  const cargarMovimientosPorConcepto = async (concepto, forzarFiltro = null) => {
    setConceptoSeleccionado(concepto);
    await cargarMovimientosBase({ concepto_id: concepto.id }, forzarFiltro);
  };

  // MVIEW005-13
  // Función para cargar todos los movimientos sin filtrar por concepto
  const cargarTodosLosMovimientos = async (forzarFiltro = null) => {
    setConceptoSeleccionado(null);
    await cargarMovimientosBase({}, forzarFiltro);
  };

  // MVIEW005-14
  // Obtiene el texto descriptivo del rango de fechas según el filtro seleccionado.
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