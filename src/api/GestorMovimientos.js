// GES-004
/**
 * GES-004 — GestorMovimientos
 * 
 * Gestión completa de movimientos financieros (ingresos y egresos) del usuario y su familia.
 * Centraliza el registro, consulta, actualización y análisis de transacciones financieras,
 * manteniendo la integridad del saldo y la relación con conceptos y metas.
 * 
 * Funciones clave:
 * - Registrar ingresos y egresos con o sin aportes a metas
 * - Consultar movimientos con filtros avanzados (fecha, tipo, concepto)
 * - Calcular totales y balances por período
 * - Actualizar movimientos existentes recalculando saldos
 * - Obtener resúmenes estadísticos por conceptos
 * - Generar análisis de movimientos con información detallada
 */

export class GestorMovimientos {

  /**
   * Crea una instancia del GestorMovimientos.
   *
   * @param {Object} supabase - Cliente de Supabase para operaciones de base de datos.
   * @param {Object} gestorMetas - Instancia del GestorMetas para operaciones relacionadas con metas.
   * @param {Object} gestorUsuario - Instancia del GestorUsuario para obtener datos del usuario.
   */
  constructor(supabase, gestorMetas, gestorUsuario) {
    this.supabase = supabase;
    this.gestorMetas = gestorMetas;
    this.gestorUsuario = gestorUsuario;
  }

  // MGES004-1
  /**
   * Registra un nuevo movimiento financiero.
   * 
   * Se usa para: Crear ingresos o egresos desde formularios de registro.
   * Actualiza automáticamente el saldo disponible del usuario y puede registrar aportes a metas.
   *
   * @async
   * @param {Object} params - Datos del movimiento a crear.
   * @param {string} params.usuarioId - ID del usuario que realiza el movimiento.
   * @param {string} params.conceptoId - ID del concepto asociado.
   * @param {"ingreso"|"egreso"} params.tipo - Tipo de movimiento.
   * @param {number} params.monto - Monto del movimiento.
   * @param {string} [params.comentario] - Comentario opcional.
   * @param {string} params.fecha - Fecha del movimiento.
   * @param {string} [params.metaId] - ID de la meta para aporte (opcional).
   * @param {number} [params.montoMeta] - Monto a aportar a la meta (opcional).
   * @returns {Promise<string>} ID del movimiento creado.
   * @throws {Error} Si falla la creación del movimiento.
   */
  async crearMovimiento({ usuarioId, conceptoId, tipo, monto, comentario, fecha, metaId, montoMeta }) {
    const { data, error } = await this.supabase.rpc("crear_movimiento", {
      p_usuario_id: usuarioId,
      p_tipo: tipo,
      p_monto: parseFloat(monto),
      p_comentario: comentario || null,
      p_fecha: fecha,
      p_concepto_id: conceptoId || null,
      p_meta_id: metaId || null,
      p_monto_meta: montoMeta || null
    });

    if (error) throw error;
    return data;
  }

  // MGES004-2
  /**
   * Calcula el total de movimientos por tipo.
   * 
   * Se usa para: Mostrar totales de ingresos o egresos en dashboards y reportes.
   *
   * @async
   * @param {string} usuarioId - ID del usuario.
   * @param {"ingreso"|"egreso"} tipo - Tipo de movimiento a totalizar.
   * @param {Object} [opciones] - Filtros opcionales de período.
   * @param {string} [opciones.fecha] - Fecha específica.
   * @param {number} [opciones.mes] - Mes a filtrar (1-12).
   * @param {number} [opciones.año] - Año a filtrar.
   * @returns {Promise<number>} Total calculado con dos decimales.
   * @throws {Error} Si falla la consulta.
   */
  async obtenerTotalPorTipo(usuarioId, tipo, opciones = {}) {
    const { fecha = null, mes = null, año = null } = opciones;

    const { data, error } = await this.supabase.rpc("obtener_total_por_tipo", {
      p_usuario_id: usuarioId,
      p_tipo: tipo,
      p_fecha: fecha,
      p_mes: mes,
      p_anio: año
    });

    if (error) throw error;

    const total = (data || []).reduce((acc, row) => acc + parseFloat(row.monto), 0);

    return Math.round(total * 100) / 100;
  }

  // MGES004-3
  /**
   * Obtiene los movimientos de un usuario con paginación y filtros.
   * 
   * Se usa para: Listar historial de movimientos en pantallas principales.
   *
   * @async
   * @param {string} usuarioId - ID del usuario.
   * @param {Object} [opciones] - Opciones de consulta.
   * @param {number} [opciones.limit=50] - Cantidad máxima de resultados.
   * @param {"asc"|"desc"} [opciones.ordenar="desc"] - Orden por fecha.
   * @param {number} [opciones.mes] - Filtrar por mes (1-12).
   * @param {number} [opciones.año] - Filtrar por año.
   * @returns {Promise<Array>} Array de movimientos con información del concepto.
   * @throws {Error} Si falla la consulta.
   */
  async obtenerMovimientosUsuario(usuarioId, opciones = {}) {
    const {
      limit = 50,
      ordenar = "desc",
      mes = null,
      año = null
    } = opciones;

    const asc = ordenar === "asc";

    const { data, error } = await this.supabase.rpc("obtener_movimientos_usuario", {
      p_usuario_id: usuarioId,
      p_limit: limit,
      p_asc: asc,
      p_mes: mes,
      p_anio: año
    });

    if (error) throw error;
    return data || [];
  }

  // MGES004-4
  /**
   * Calcula el balance financiero en un rango de fechas.
   * 
   * Se usa para: Generar reportes de período y análisis de flujo de efectivo.
   * Puede obtener movimientos personales o familiares según el tipo especificado.
   *
   * @async
   * @param {Object} params - Parámetros de consulta.
   * @param {string} params.fechaInicio - Fecha inicial del rango.
   * @param {string} params.fechaFin - Fecha final del rango.
   * @param {string} params.tipo - Tipo de reporte (personal/familiar).
   * @param {string} params.usuarioId - ID del usuario.
   * @returns {Promise<Object>} Objeto con movimientos y totales calculados (ingresos, egresos, balance).
   * @throws {Error} Si falla la consulta.
   */
  async obtenerBalanceEntreFechas({ fechaInicio, fechaFin, tipo, usuarioId }) {
    const { data, error } = await this.supabase.rpc("movimientos_rango_fechas", {
      p_usuario_id: usuarioId,
      p_tipo: tipo,
      p_fecha_inicio: fechaInicio,
      p_fecha_fin: fechaFin
    });

    if (error) throw error;

    const movimientos = data || [];

    let ingresos = 0;
    let egresos = 0;

    movimientos.forEach(m => {
      if (m.tipo === "ingreso") ingresos += Number(m.monto);
      else egresos += Number(m.monto);
    });

    return {
      movimientos,
      totales: {
        ingresos,
        egresos,
        balance: ingresos - egresos
      }
    };
  }

  // MGES004-5
  /**
   * Obtiene movimientos con información completa de sus conceptos.
   * 
   * Se usa para: Generar reportes por categoría y análisis de gastos detallados.
   *
   * @async
   * @param {string} usuarioId - ID del usuario.
   * @param {Object} [opciones] - Opciones de consulta.
   * @param {number} [opciones.limit=100] - Cantidad máxima de resultados.
   * @param {"asc"|"desc"} [opciones.ordenar="desc"] - Orden por fecha.
   * @returns {Promise<Array>} Array de movimientos con metadatos del concepto.
   * @throws {Error} Si falla la consulta.
   */
  async obtenerMovimientosConConceptos(usuarioId, opciones = {}) {
    const { limit = 100, ordenar = "desc" } = opciones;
    const asc = ordenar === "asc";

    const { data, error } = await this.supabase.rpc("movimientos_con_conceptos", {
      p_usuario_id: usuarioId,
      p_limit: limit,
      p_asc: asc
    });

    if (error) throw error;
    return data || [];
  }

  // MGES004-6
  /**
   * Actualiza un movimiento existente.
   * 
   * Se usa para: Editar movimientos desde formularios de corrección.
   * Recalcula automáticamente el impacto en el saldo disponible del usuario.
   *
   * @async
   * @param {string} movimientoId - ID del movimiento a actualizar.
   * @param {Object} datosActualizados - Campos a modificar.
   * @param {number} [datosActualizados.monto] - Nuevo monto.
   * @param {string} [datosActualizados.fecha] - Nueva fecha.
   * @param {string} [datosActualizados.comentario] - Nuevo comentario.
   * @returns {Promise<Object>} Movimiento actualizado.
   * @throws {Error} Si falla la actualización.
   */
  async actualizarMovimiento(movimientoId, datosActualizados) {
    try {
      const { monto = null, fecha = null, comentario = null } = datosActualizados;

      const { data, error } = await this.supabase.rpc("actualizar_movimiento", {
        p_movimiento_id: movimientoId,
        p_monto: monto !== null ? parseFloat(monto) : null,
        p_fecha: fecha,
        p_comentario: comentario
      });

      if (error) throw error;

      return data;

    } catch (err) {
      console.error("ERROR en actualizarMovimiento (RPC):", err);
      throw err;
    }
  }

  // MGES004-7
  /**
   * Aplica filtros avanzados para búsqueda de movimientos.
   * 
   * Se usa para: Análisis familiar y búsquedas específicas en el historial financiero.
   *
   * @async
   * @param {Object} [opciones] - Filtros de búsqueda.
   * @param {Array<string>} [opciones.usuariosIds] - IDs de usuarios a incluir (requerido).
   * @param {string} [opciones.conceptoId] - ID del concepto a filtrar.
   * @param {string} [opciones.fechaInicio] - Fecha inicial del rango.
   * @param {string} [opciones.fechaFin] - Fecha final del rango.
   * @param {"asc"|"desc"} [opciones.ordenar="desc"] - Orden por fecha.
   * @param {number} [opciones.limit] - Límite de resultados.
   * @returns {Promise<Array>} Array de movimientos filtrados con conceptos, usuarios y aportes.
   * @throws {Error} Si no se proporcionan IDs de usuarios o falla la consulta.
   */
  async obtenerMovimientosFiltrados(opciones = {}) {
    try {
      const {
        usuariosIds = [],
        conceptoId = null,
        fechaInicio = null,
        fechaFin = null,
        ordenar = "desc",
        limit = null
      } = opciones;

      if (!usuariosIds || usuariosIds.length === 0) {
        throw new Error("Se requiere al menos un ID de usuario");
      }

      const { data, error } = await this.supabase.rpc(
        "filtrar_movimientos_avanzado",
        {
          p_usuarios_ids: usuariosIds,
          p_concepto_id: conceptoId,
          p_fecha_inicio: fechaInicio,
          p_fecha_fin: fechaFin,
          p_asc: ordenar === "asc",
          p_limit: limit
        }
      );

      if (error) throw error;
      return data || [];

    } catch (err) {
      console.error("ERROR en obtenerMovimientosFiltrados:", err);
      throw err;
    }
  }


  // MGES004-8
  /**
   * Genera un resumen estadístico agrupado por conceptos.
   * 
   * Se usa para: Dashboards y reportes visuales de gastos por categoría.
   *
   * @async
   * @param {string} usuarioId - ID del usuario.
   * @param {Object} [opciones] - Filtros de período.
   * @param {number} [opciones.mes] - Filtrar por mes (1-12).
   * @param {number} [opciones.año] - Filtrar por año.
   * @returns {Promise<Object>} Resumen con top 3 de ingresos/egresos y listados completos ordenados.
   */
  async calcularResumenConceptos(usuarioId, opciones = {}) {
    let movimientos = await this.obtenerMovimientosConConceptos(usuarioId);

    const { mes = null, año = null } = opciones;

    if (mes && año) {
      movimientos = movimientos.filter(m => {
        if (!m.fecha) return false;
        const f = new Date(m.fecha);
        return (f.getMonth() + 1 === mes && f.getFullYear() === año);
      });
    }

    const conceptosMap = {};

    movimientos.forEach(mov => {
      if (mov.conceptos && mov.conceptos.nombre) {
        const conceptoId = mov.conceptos.id;
        const nombre = mov.conceptos.nombre;
        const tipo = mov.conceptos.tipo;
        const monto = Number(mov.monto) || 0;

        if (!conceptosMap[conceptoId]) {
          conceptosMap[conceptoId] = { id: conceptoId, nombre, tipo, total: 0 };
        }
        conceptosMap[conceptoId].total += monto;
      }
    });

    const egresos = Object.values(conceptosMap)
      .filter(c => c.tipo === "egreso")
      .sort((a, b) => b.total - a.total);

    const ingresos = Object.values(conceptosMap)
      .filter(c => c.tipo === "ingreso")
      .sort((a, b) => b.total - a.total);

    return {
      topEgresos: egresos.slice(0, 3),
      topIngresos: ingresos.slice(0, 3),
      todosEgresos: egresos,
      todosIngresos: ingresos
    };
  }

  // MGES004-9
  /**
   * Obtiene un movimiento específico por su ID.
   * 
   * Se usa para: Pantallas de detalle y formularios de edición de movimientos.
   *
   * @async
   * @param {string} movimientoId - ID del movimiento a consultar.
   * @returns {Promise<Object>} Movimiento con información del concepto y usuario propietario.
   * @throws {Error} Si falla la consulta.
   */
  async obtenerMovimientoPorId(movimientoId) {
    const { data, error } = await this.supabase.rpc("movimiento_por_id", {
      p_movimiento_id: movimientoId
    });

    if (error) throw error;
    return data;
  }
}