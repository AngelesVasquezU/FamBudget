// GES-004
/**
 * GestorMovimientos – Gestión de movimientos financieros.
 *
 * Funcionalidades:
 * - Registro de ingresos
 * - Registro de egresos
 * - Filtrado de movimientos
 * - Cálculo de balance
 * - Obtención de totales
 * - Análisis por concepto
 *
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

  // MGES004-1 — Crear Movimiento
  /**
   * Crea un nuevo movimiento financiero mediante la función RPC
   * `crear_movimiento`, que gestiona:
   * - inserción del movimiento
   * - validación del saldo
   * - actualización de saldo del usuario
   * - registro de ahorro y actualización de metas
   *
   * @param {Object} params
   * @param {string} params.usuarioId - ID del usuario dueño del movimiento.
   * @param {string|null} params.conceptoId - Concepto asociado.
   * @param {"ingreso"|"egreso"} params.tipo - Tipo de movimiento.
   * @param {number|string} params.monto - Monto del movimiento.
   * @param {string|null} params.comentario - Comentario opcional.
   * @param {string} params.fecha - Fecha en formato YYYY-MM-DD.
   * @param {string|null} params.metaId - ID de la meta asociada (si aplica).
   * @param {number|null} params.montoMeta - Monto destinado a la meta.
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

  // MGES004-2 — Total por Tipo
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
   * @param {string|null} [opciones.fecha] - Fecha exacta (YYYY-MM-DD).
   * @param {number|null} [opciones.mes] - Mes a filtrar.
   * @param {number|null} [opciones.año] - Año a filtrar.
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

  // MGES004-3 — Movimientos del Usuario
  /**
   * Obtiene los movimientos registrados por un usuario.
   * Permite filtrar por:
   * - mes y año
   * - límite de registros
   * - orden ascendente/descendente
   *
   * Incluye los datos del concepto mediante relación.
   *
   * @param {string} usuarioId - Usuario dueño de los movimientos.
   * @param {Object} opciones - Opciones de filtrado.
   * @param {number} [opciones.limit=50] - Cantidad de registros.
   * @param {"asc"|"desc"} [opciones.ordenar="desc"] - Orden.
   * @param {number|null} [opciones.mes] - Mes a filtrar.
   * @param {number|null} [opciones.año] - Año a filtrar.
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

  // MGES004-4 — Balance entre Fechas
  /**
   * Obtiene movimientos y balance dentro de un rango de fechas.
   * Puede ser modo personal o familiar.
   *
   * @param {Object} params
   * @param {string} params.fechaInicio - Fecha inicial (YYYY-MM-DD).
   * @param {string} params.fechaFin - Fecha final (YYYY-MM-DD).
   * @param {"personal"|"familiar"} params.tipo
   * @param {string} params.usuarioId
   *
   * @returns {Promise<Object>} Movimientos y totales.
   */
  async obtenerBalanceEntreFechas({ fechaInicio, fechaFin, tipo, usuarioId }) {
    try {
      let query = this.supabase
        .from("movimientos")
        .select(`
          *,
          usuarios:usuario_id(id, nombre),
          conceptos:concepto_id(id, nombre, tipo)
        `)
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

  // MGES004-5 — Movimientos con Conceptos
  /**
   * Obtiene movimientos del usuario con datos completos del concepto.
   *
   * @param {string} usuarioId
   * @param {Object} opciones
   * @param {number} [opciones.limit=100] - Cantidad de registros
   * @param {"asc"|"desc"} [opciones.ordenar="desc"] - Orden
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

  // MGES004-6 — Actualizar Movimiento (vía RPC)
  /**
   * Actualiza un movimiento mediante la función RPC `actualizar_movimiento`.
   *
   * Puede actualizar:
   * - monto
   * - fecha
   * - comentario
   * Y opcionalmente:
   * - meta asociada (metaId)
   * - monto destinado a la meta (montoMeta)
   *
   * @param {string} movimientoId - ID del movimiento a actualizar.
   * @param {Object} datosActualizados
   * @param {number|string} [datosActualizados.monto]
   * @param {string}        [datosActualizados.fecha]      - YYYY-MM-DD
   * @param {string|null}   [datosActualizados.comentario]
   *
   * @returns {Promise<Object>} Movimiento actualizado.
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
      console.error("ERROR en actualizarMovimiento:", err);
      throw err;
    }
  }

  // MGES004-7 — Filtro Avanzado
  /**
   * Obtiene movimientos aplicando filtros avanzados:
   * - lista de usuarios
   * - concepto específico
   * - rango de fechas
   * - orden
   * - límite
   *
   * @param {Object} opciones - Opciones del filtro.
   * @param {string[]} opciones.usuariosIds - IDs de usuarios.
   * @param {string|null} [opciones.conceptoId] - Concepto.
   * @param {string|null} [opciones.fechaInicio] - Fecha inicial.
   * @param {string|null} [opciones.fechaFin] - Fecha final.
   * @param {"asc"|"desc"} [opciones.ordenar="desc"] - Orden.
   * @param {number|null} [opciones.limit] - Límite.
   *
   * @returns {Promise<Array>} Movimientos filtrados.
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
   * Calcula el resumen agregado por conceptos:
   * - Top 3 ingresos
   * - Top 3 egresos
   * - Listado completo de ambas categorías
   *
   * @param {string} usuarioId - Usuario a analizar.
   * @param {Object} opciones
   * @param {number|null} opciones.mes - Mes del análisis.
   * @param {number|null} opciones.año - Año del análisis.
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

  // MGES004-9 — Movimiento por ID
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
}
