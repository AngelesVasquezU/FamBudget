// GES-004
/**
 * GestorMovimientos
 * -----------------
 * Módulo responsable de manejar todos los procesos relacionados con los
 * movimientos financieros de un usuario o familia. Centraliza la interacción
 * con la base de datos mediante funciones RPC y consultas directas optimizadas.
 *
 * FUNCIONES PRINCIPALES:
 * - Registrar ingresos y egresos (crear_movimiento)
 * - Consultar movimientos con distintos niveles de detalle
 * - Calcular totales y balances
 * - Obtener información combinada (movimientos + conceptos + usuario)
 * - Actualizar movimientos existentes manteniendo la integridad del saldo
 */

export class GestorMovimientos {

  /**
   * @param {SupabaseClient} supabase - Cliente Supabase
   * @param {GestorMetas} gestorMetas - Gestor de metas
   * @param {GestorUsuario} gestorUsuario - Gestor de usuario/familia
   */
  constructor(supabase, gestorMetas, gestorUsuario) {
    this.supabase = supabase;
    this.gestorMetas = gestorMetas;
    this.gestorUsuario = gestorUsuario;
  }

  // MGES004-1 — Crear Movimiento
  /**
   * Registra un nuevo movimiento financiero.
   *
   * Esta acción se delega totalmente a la función RPC `crear_movimiento`,
   * la cual se encarga internamente de:
   * - Validar el tipo de movimiento (ingreso o egreso).
   * - Verificar saldo disponible (en caso de egresos o aportes).
   * - Insertar el movimiento en la tabla `movimientos`.
   * - Descontar o incrementar el saldo disponible del usuario.
   * - Registrar aportes a metas si se proporcionan `metaId` y `montoMeta`.
   *
   * @param {Object} params - Datos del movimiento.
   * @returns {Promise<string>} ID del nuevo movimiento.
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

  // MGES004-2 — Total por Tipo
  /**
   * Obtiene la suma total de dinero correspondiente a un tipo de movimiento:
   * INGRESO o EGRESO.
   *
   * Flujo:
   * 1. Se consultan los montos relacionados (via SELECT RPC o query simple).
   * 2. Se aplica el filtro solicitado: fecha exacta o mes/año.
   * 3. El cálculo final (suma) se hace en el cliente para asegurar precisión.
   *
   * @param {string} usuarioId - Usuario propietario de los movimientos.
   * @param {"ingreso"|"egreso"} tipo - Tipo de movimiento a sumar.
   * @param {Object} [opciones] - Filtros opcionales de tiempo.
   * @returns {Promise<number>} Total sumado con dos decimales.
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

  // MGES004-3 — Movimientos del Usuario
  /**
   * Recupera los movimientos de un usuario y permite paginarlos,
   * filtrarlos por mes/año y ordenar por fecha.
   *
   * Retorna también el concepto asociado mediante JOIN.
   *
   * Útil para:
   * - Historial del usuario
   * - Paginación de movimientos
   * - Listas filtradas rápidamente sin costosos joins adicionales
   *
   * @returns {Promise<Array>} Lista de movimientos del usuario.
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

  // MGES004-4 — Balance entre Fechas
  /**
   * Obtiene todos los movimientos dentro de un rango de fechas y calcula:
   * - Total de ingresos
   * - Total de egresos
   * - Balance final
   *
   * También permite modo:
   * - PERSONAL → Solo movimientos del usuario
   * - FAMILIAR → Movimientos de todos los miembros de la familia
   *
   * @returns {Promise<Object>} Movimientos + totales acumulados.
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


  // MGES004-5 — Movimientos con Conceptos
  /**
   * Obtiene movimientos del usuario junto con los metadatos completos 
   * de su concepto asociado.
   *
   * Resulta útil para:
   * - Graficar gastos por categoría
   * - Listados detallados con etiquetas de concepto
   *
   * @returns {Promise<Array>} Movimientos con información descriptiva.
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

  // MGES004-6 — Actualizar Movimiento
  /**
   * Actualiza campos editables de un movimiento:
   * - monto
   * - fecha
   * - comentario
   *
   * Esta operación se delega a la RPC `actualizar_movimiento`, que garantiza:
   * - Recalcular y aplicar la diferencia sobre el saldo disponible del usuario.
   *
   * @returns {Promise<Object>} Movimiento actualizado desde la BD.
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

  // MGES004-7 — Filtro Avanzado
  /**
   * Devuelve movimientos aplicando múltiples filtros:
   * - varios usuarios
   * - un concepto específico
   * - rango de fechas
   * - orden dinámico
   * - límite de registros
   *
   * Este método se usa en vistas avanzadas como análisis familiar
   * o búsquedas detalladas del historial financiero.
   *
   * @returns {Promise<Array>} Lista de movimientos filtrados.
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

      let query = this.supabase
        .from('movimientos')
        .select(`
          *,
          conceptos:concepto_id(*),
          usuarios:usuario_id(nombre),
          ahorro:ahorro(monto)
        `)
        .in('usuario_id', usuariosIds)
        .order('fecha', { ascending: ordenar === "asc" });

      if (conceptoId) query = query.eq('concepto_id', conceptoId);
      if (fechaInicio) query = query.gte('fecha', fechaInicio);
      if (fechaFin) query = query.lte('fecha', fechaFin);
      if (limit) query = query.limit(limit);

      const { data: movimientos, error } = await query;
      if (error) throw error;

      return movimientos || [];

    } catch (err) {
      console.error("ERROR en obtenerMovimientosFiltrados:", err);
      throw err;
    }
  }

  // MGES004-8 — Resumen por Conceptos
  /**
   * Construye un resumen estadístico basado en conceptos:
   * - Top 3 de ingresos más frecuentes
   * - Top 3 de egresos más altos
   * - Listado completo ordenado por monto total acumulado
   *
   *
   * @returns {Promise<Object>} Resumen estadístico por conceptos.
   */

  async calcularResumenConceptos(usuarioId, opciones = {}) {
    // Se queda igual, solo lógica en JS
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

  // MGES004-9 — Movimiento por ID
  /**
   * Recupera un movimiento específico por su ID, incorporando:
   * - información del concepto
   * - nombre del usuario propietario
   *
   * Útil para:
   * - pantallas de detalle
   * - edición y vistas específicas
   *
   * @param {string} movimientoId - ID del movimiento buscado.
   * @returns {Promise<Object>} Movimiento con datos relacionados.
   */

  async obtenerMovimientoPorId(movimientoId) {
    const { data, error } = await this.supabase.rpc("movimiento_por_id", {
      p_movimiento_id: movimientoId
    });

    if (error) throw error;
    return data;
  }
}
