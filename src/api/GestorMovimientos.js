/**
 * GestorMovimientos
 * -----------------
 * Responsable de administrar todas las operaciones relacionadas con los
 * movimientos financieros del usuario (ingresos, egresos, filtrado,
 * cálculo de totales, balance, top de conceptos, etc.).
 *
 * Identificador de módulo: GES-004
 *
 * Este gestor es el punto central para toda interacción entre la capa de
 * aplicación y las tablas:
 * - movimientos
 * - usuarios
 * - conceptos
 * - ahorro (vía gestorMetas cuando aplica)
 *
 * Algunas operaciones (como la creación de movimientos) se delegan ahora
 * a funciones SQL (RPC) para cumplir buenas prácticas de seguridad.
 */
export class GestorMovimientos {

  /**
   * Constructor del gestor de movimientos.
   *
   * @param {SupabaseClient} supabase - Instancia del cliente de Supabase.
   * @param {GestorMetas} gestorMetas - Gestor encargado del manejo de metas y ahorro.
   * @param {GestorUsuario} gestorUsuario - Gestor encargado de operaciones del usuario y familia.
   */
  constructor(supabase, gestorMetas, gestorUsuario) {
    this.supabase = supabase;
    this.gestorMetas = gestorMetas;
    this.gestorUsuario = gestorUsuario;
  }

  // ============================================================
  // MGES004-1 — Crear Movimiento
  // ============================================================

  /**
   * Crea un movimiento financiero (ingreso o egreso).
   *
   * Esta función ya no realiza lógica manual en JavaScript. En su lugar,
   * delega la operación a la función SQL `crear_movimiento`, la cual:
   * - inserta el movimiento
   * - valida saldos
   * - actualiza saldo del usuario
   * - registra ahorro si está asociado a una meta
   * - actualiza el estado de dicha meta
   *
   * @param {Object} params
   * @param {string} params.usuarioId - ID del usuario dueño del movimiento.
   * @param {string|null} params.conceptoId - Concepto asociado al movimiento.
   * @param {"ingreso"|"egreso"} params.tipo - Tipo de movimiento.
   * @param {number|string} params.monto - Monto del movimiento.
   * @param {string|null} params.comentario - Comentario opcional.
   * @param {string} params.fecha - Fecha en formato YYYY-MM-DD.
   * @param {string|null} params.metaId - ID de la meta asociada (si aplica).
   * @param {number|null} params.montoMeta - Monto destinado al ahorro en la meta.
   *
   * @returns {Promise<string>} ID del movimiento creado.
   * @throws {Error} Si la función RPC retorna algún error.
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

  // ============================================================
  // MGES004-2 — Total por Tipo
  // ============================================================

  /**
   * Calcula el total de ingresos o egresos de un usuario.
   *
   * Permite filtrar opcionalmente por:
   * - fecha exacta
   * - mes y año
   *
   * @param {string} usuarioId - ID del usuario.
   * @param {"ingreso"|"egreso"} tipo - Tipo de movimiento.
   * @param {Object} [opciones]
   * @param {string|null} [opciones.fecha]
   * @param {number|null} [opciones.mes]
   * @param {number|null} [opciones.año]
   *
   * @returns {Promise<number>} Total acumulado.
   */
  async obtenerTotalPorTipo(usuarioId, tipo, opciones = {}) {
    const { fecha = null, mes = null, año = null } = opciones;
    let query = this.supabase
      .from("movimientos")
      .select("monto")
      .eq("usuario_id", usuarioId)
      .eq("tipo", tipo);

    if (fecha) query = query.eq("fecha", fecha);

    if (mes && año) {
      const ultimoDia = new Date(año, mes, 0).getDate();
      const inicio = `${año}-${String(mes).padStart(2, "0")}-01`;
      const fin = `${año}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
      query = query.gte("fecha", inicio).lte("fecha", fin);
    }

    const { data, error } = await query;
    if (error) throw error;

    const total = data.reduce((acc, mov) => acc + parseFloat(mov.monto), 0);
    return Math.round(total * 100) / 100;
  }

  // ============================================================
  // MGES004-3 — Movimientos del Usuario
  // ============================================================

  /**
   * Obtiene los movimientos registrados por un usuario.
   * Permite filtrar por:
   * - mes y año
   * - límite de registros
   * - orden ascendente/descendente
   *
   * Incluye los datos del concepto mediante relación.
   *
   * @param {string} usuarioId
   * @param {Object} opciones
   * @param {number} [opciones.limit=50]
   * @param {"asc"|"desc"} [opciones.ordenar="desc"]
   * @param {number|null} [opciones.mes]
   * @param {number|null} [opciones.año]
   *
   * @returns {Promise<Array>} Lista de movimientos.
   */
  async obtenerMovimientosUsuario(usuarioId, opciones = {}) {
    try {
      const {
        limit = 50,
        ordenar = "desc",
        mes = null,
        año = null
      } = opciones;

      let query = this.supabase
        .from("movimientos")
        .select(`
          id,
          usuario_id,
          concepto_id,
          tipo,
          monto,
          comentario,
          fecha,
          conceptos ( id, nombre )
        `)
        .eq("usuario_id", usuarioId)
        .order("fecha", { ascending: ordenar === "asc" })
        .limit(limit);

      if (mes && año) {
        const inicio = `${año}-${String(mes).padStart(2, "0")}-01`;
        const fin = `${año}-${String(mes).padStart(2, "0")}-31`;
        query = query.gte("fecha", inicio).lte("fecha", fin);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data;

    } catch (err) {
      console.error("ERROR en obtenerMovimientosUsuario:", err);
      throw err;
    }
  }

  // ============================================================
  // MGES004-4 — Balance entre Fechas
  // ============================================================

  /**
   * Obtiene el balance (ingresos, egresos y total) dentro de un rango
   * de fechas. Puede ser:
   * - personal (solo del usuario)
   * - familiar (todos los miembros de la familia)
   *
   * @param {Object} params
   * @param {string} params.fechaInicio
   * @param {string} params.fechaFin
   * @param {"personal"|"familiar"} params.tipo
   * @param {string} params.usuarioId
   *
   * @returns {Promise<Object>}
   *   movimientos: Array
   *   totales: { ingresos: number, egresos: number, balance: number }
   */
  async obtenerBalanceEntreFechas({ fechaInicio, fechaFin, tipo, usuarioId }) {
    try {
      let query = this.supabase
        .from("movimientos")
        .select("*")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin);

      if (tipo === "personal") {
        query = query.eq("usuario_id", usuarioId);
      } else if (tipo === "familiar") {
        const miembros = await this.gestorUsuario.obtenerUsuariosDeMiFamilia();
        const ids = miembros.map(m => m.id);

        if (ids.length === 0) {
          return {
            movimientos: [],
            totales: { ingresos: 0, egresos: 0, balance: 0 }
          };
        }

        query = query.in("usuario_id", ids);
      }

      const { data: movimientos, error } = await query;
      if (error) throw error;

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

    } catch (err) {
      console.error("Error en obtenerBalanceEntreFechas:", err);
      throw err;
    }
  }

  // ============================================================
  // MGES004-5 — Movimientos con Conceptos
  // ============================================================

  /**
   * Obtiene movimientos del usuario junto con su información de
   * concepto, útil para análisis (top categorías de ingresos/egresos).
   *
   * @param {string} usuarioId
   * @param {Object} opciones
   * @param {number} [opciones.limit=100]
   * @param {"asc"|"desc"} [opciones.ordenar="desc"]
   *
   * @returns {Promise<Array>}
   */
  async obtenerMovimientosConConceptos(usuarioId, opciones = {}) {
    try {
      const {
        limit = 100,
        ordenar = "desc"
      } = opciones;

      const { data: movimientos, error } = await this.supabase
        .from('movimientos')
        .select(`
          id,
          monto,
          fecha,
          concepto_id,
          conceptos (
            id,
            nombre,
            tipo
          )
        `)
        .eq('usuario_id', usuarioId)
        .order('fecha', { ascending: ordenar === "asc" })
        .limit(limit);

      if (error) throw error;

      return movimientos || [];

    } catch (err) {
      console.error("ERROR en obtenerMovimientosConConceptos:", err);
      throw err;
    }
  }

  // ============================================================
  // MGES004-6 — Actualizar Movimiento
  // ============================================================

  /**
   * Actualiza los campos permitidos de un movimiento:
   * - monto
   * - fecha
   * - comentario
   *
   * @param {string} movimientoId
   * @param {Object} datosActualizados
   *
   * @returns {Promise<Object>} Movimiento actualizado.
   */
  async actualizarMovimiento(movimientoId, datosActualizados) {
    try {
      const { monto, fecha, comentario } = datosActualizados;

      const actualizacion = {};
      if (monto !== undefined) actualizacion.monto = parseFloat(monto);
      if (fecha !== undefined) actualizacion.fecha = fecha;
      if (comentario !== undefined) actualizacion.comentario = comentario;

      const { data, error } = await this.supabase
        .from('movimientos')
        .update(actualizacion)
        .eq('id', movimientoId)
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (err) {
      console.error("ERROR en actualizarMovimiento:", err);
      throw err;
    }
  }

  // ============================================================
  // MGES004-7 — Filtro Avanzado
  // ============================================================

  /**
   * Obtiene movimientos aplicando filtros avanzados:
   * - lista de usuarios
   * - concepto específico
   * - rango de fechas
   * - orden
   * - límite
   *
   * Incluye JOINs con conceptos, usuarios y ahorro.
   *
   * @param {Object} opciones
   * @param {string[]} opciones.usuariosIds
   * @param {string|null} [opciones.conceptoId]
   * @param {string|null} [opciones.fechaInicio]
   * @param {string|null} [opciones.fechaFin]
   * @param {"asc"|"desc"} [opciones.ordenar="desc"]
   * @param {number|null} [opciones.limit]
   *
   * @returns {Promise<Array>}
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

  // ============================================================
  // MGES004-8 — Resumen por Conceptos
  // ============================================================

  /**
   * Calcula el resumen agregado por conceptos:
   * - Top 3 ingresos
   * - Top 3 egresos
   * - Listado completo de ambas categorías
   *
   * @param {string} usuarioId
   * @param {Object} opciones
   * @param {number|null} opciones.mes
   * @param {number|null} opciones.año
   *
   * @returns {Promise<Object>}
   */
  async calcularResumenConceptos(usuarioId, opciones = {}) {
    try {
      const { mes = null, año = null } = opciones;

      let movimientos = await this.obtenerMovimientosConConceptos(usuarioId);

      if (mes && año) {
        movimientos = movimientos.filter(m => {
          if (!m.fecha) return false;
          const f = new Date(m.fecha);
          return (
            f.getMonth() + 1 === mes &&
            f.getFullYear() === año
          );
        });
      }

      const conceptosMap = {};

      movimientos.forEach(mov => {
        if (mov.conceptos && mov.conceptos.nombre) {
          const conceptoId = mov.conceptos.id;
          const nombre = mov.conceptos.nombre;
          const tipo = mov.conceptos.tipo;
          const monto = parseFloat(mov.monto) || 0;

          if (monto > 0) {
            if (!conceptosMap[conceptoId]) {
              conceptosMap[conceptoId] = {
                id: conceptoId,
                nombre,
                tipo,
                total: 0
              };
            }
            conceptosMap[conceptoId].total += monto;
          }
        }
      });

      const egresosArray = Object.values(conceptosMap)
        .filter(c => c.tipo === 'egreso')
        .sort((a, b) => b.total - a.total);

      const ingresosArray = Object.values(conceptosMap)
        .filter(c => c.tipo === 'ingreso')
        .sort((a, b) => b.total - a.total);

      return {
        topEgresos: egresosArray.slice(0, 3),
        topIngresos: ingresosArray.slice(0, 3),
        todosEgresos: egresosArray,
        todosIngresos: ingresosArray
      };

    } catch (err) {
      console.error("ERROR en calcularResumenConceptos:", err);
      throw err;
    }
  }

  // ============================================================
  // MGES004-9 — Movimiento por ID
  // ============================================================

  /**
   * Obtiene un movimiento por ID con toda su información relacionada:
   * - concepto
   * - usuario
   *
   * @param {string} movimientoId
   * @returns {Promise<Object>}
   */
  async obtenerMovimientoPorId(movimientoId) {
    try {
      const { data, error } = await this.supabase
        .from('movimientos')
        .select(`
          *,
          conceptos:concepto_id(*),
          usuarios:usuario_id(nombre)
        `)
        .eq('id', movimientoId)
        .single();

      if (error) throw error;

      return data;

    } catch (err) {
      console.error("ERROR en obtenerMovimientoPorId:", err);
      throw err;
    }
  }

  // ============================================================
  // MGES004-10 — Eliminar Movimiento
  // ============================================================

  /**
   * Elimina un movimiento del sistema.
   *
   * @param {string} movimientoId
   * @returns {Promise<{success: boolean}>}
   */
  async eliminarMovimiento(movimientoId) {
    try {
      const { error } = await this.supabase
        .from('movimientos')
        .delete()
        .eq('id', movimientoId);

      if (error) throw error;

      return { success: true };

    } catch (err) {
      console.error("ERROR en eliminarMovimiento:", err);
      throw err;
    }
  }
}
