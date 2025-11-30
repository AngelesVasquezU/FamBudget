// GES-003
/**
 * GestorMetas
 * 
 * Módulo encargado de administrar todo lo relacionado a las metas financieras:
 * - Creación, edición y eliminación de metas
 * - Registro de aportes de ahorro
 * - Validación de saldos
 * - Actualización de progreso de metas
 * - Obtención de metas personales y familiares
 */

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN"
  }).format(amount);
};

export class GestorMetas { // GES-003

  /**
   * Constructor del gestor de metas.
   *
   * @param {SupabaseClient} supabase - Cliente de Supabase.
   * @param {GestorUsuario} gestorUsuario - Gestor encargado de obtener datos del usuario.
   */
  constructor(supabase, gestorUsuario) {
    this.supabase = supabase;
    this.gestorUsuario = gestorUsuario;
  }

  // MGES003-1 — Obtener metas visibles por usuario
  /**
   * Obtiene todas las metas visibles para un usuario.
   * Esta función llama directamente al RPC:
   *     obtener_metas(usuario_id_input)
   *
   * Regresa:
   * - Metas personales
   * - Metas familiares (si el usuario pertenece a una familia)
   *
   * @param {string} usuarioId - ID del usuario.
   * @returns {Promise<Array>} Lista de metas visibles.
   */
  async obtenerMetas(usuarioId) {
    try {
      const { data, error } = await this.supabase.rpc("obtener_metas", {
        usuario_id_input: usuarioId
      });

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error("Error en obtenerMetas:", error);
      throw error;
    }
  }

  // MGES003-2 — Crear una nueva meta
  /**
   * Crea una nueva meta utilizando el RPC:
   *     crear_meta(...)
   *
   * @param {Object} params - Parámetros de creación.
   * @returns {Promise<Object>} Meta creada.
   */
  async crearMeta({ nombre, monto_objetivo, fecha_limite, familia_id, usuario_id, es_familiar }) {
    try {
      const { data, error } = await this.supabase.rpc("crear_meta", {
        nombre,
        monto_objetivo,
        fecha_limite,
        familia_id,
        usuario_id,
        es_familiar
      });

      if (error) throw error;
      return data;

    } catch (error) {
      console.error("Error en crearMeta:", error);
      throw error;
    }
  }

  // MGES003-3 — Editar meta existente
  /**
   * Edita una meta a través del RPC:
   *     editar_meta(...)
   *
   * El usuario actual se obtiene desde GestorUsuario.
   *
   * @param {string} id - ID de la meta.
   * @param {Object} params - Datos a actualizar.
   * @returns {Promise<Object>} Meta actualizada.
   */
  async editarMeta(id, { nombre, monto_objetivo, fecha_limite, es_familiar }) {
    try {
      const usuario_id = await this.gestorUsuario.obtenerIdUsuario();
      if (!usuario_id) throw new Error("No se pudo obtener el ID del usuario");

      const { data, error } = await this.supabase.rpc("editar_meta", {
        p_id: id,
        p_nombre: nombre,
        p_monto_objetivo: monto_objetivo,
        p_fecha_limite: fecha_limite,
        p_es_familiar: es_familiar,
        p_usuario_id: usuario_id
      });

      if (error) throw error;
      return data;

    } catch (error) {
      console.error("Error en editarMeta:", error);
      throw error;
    }
  }

  // MGES003-4 — Eliminar meta
  /**
   * Elimina una meta por su ID mediante RPC:
   *     eliminar_meta(id)
   *
   * No elimina registros de ahorro relacionados.
   *
   * @param {string} id - ID de la meta.
   * @returns {Promise<boolean>}
   */
  async eliminarMeta(id) {
    try {
      const { data, error } = await this.supabase.rpc("eliminar_meta", {
        meta_id: id
      });

      if (error) throw error;
      return data === true;

    } catch (error) {
      console.error("Error en eliminarMeta:", error);
      throw error;
    }
  }

  // MGES003-5 — Agregar ahorro
  /**
   * Registra un aporte y actualiza:
   * - meta.monto_actual
   * - usuarios.saldo_disponible
   * - tabla ahorro
   *
   * Esta operación se realiza COMPLETAMENTE en el RPC:
   *     agregar_ahorro(...)
   *
   * @param {string} metaId
   * @param {number} monto
   * @param {string} usuarioId
   * @param {string|null} movimientoId
   * @returns {Promise<Object>}
   */
  async agregarAhorro(metaId, monto, usuarioId, movimientoId = null) {
    try {
      const { data, error } = await this.supabase.rpc("agregar_ahorro", {
        p_meta_id: metaId,
        p_monto: monto,
        p_usuario_id: usuarioId,
        p_movimiento_id: movimientoId
      });

      if (error) throw error;
      return data;

    } catch (error) {
      console.error("Error en agregarAhorro:", error);
      throw error;
    }
  }

  // MGES003-6 — Obtener saldo disponible
  /**
   * Obtiene el saldo disponible de un usuario.
   * RPC utilizado:
   *     obtener_saldo_disponible(usuario_id_input)
   *
   * @param {string} usuarioId
   * @returns {Promise<number>}
   */
  async obtenerSaldoDisponible(usuarioId) {
    try {
      const { data, error } = await this.supabase.rpc("obtener_saldo_disponible", {
        usuario_id_input: usuarioId
      });

      if (error) throw error;
      return parseFloat(data || 0);

    } catch (error) {
      console.error("Error en obtenerSaldoDisponible:", error);
      throw error;
    }
  }

  // MGES003-7 — Obtener aportes por meta
  /**
   * Obtiene todos los aportes de una meta (con movimientos + usuario).
   * RPC:
   *     obtener_aportes_por_meta(meta_id_input)
   *
   * @param {string} metaId
   * @returns {Promise<Array>}
   */
  async obtenerAportesPorMeta(metaId) {
    try {
      const { data, error } = await this.supabase.rpc("obtener_aportes_por_meta", {
        meta_id_input: metaId
      });

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error("Error en obtenerAportesPorMeta:", error);
      throw error;
    }
  }

}
