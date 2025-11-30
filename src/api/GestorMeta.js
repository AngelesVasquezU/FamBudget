// GES-003
/**
 * GES-003 — GestorMetas
 * 
 * Administración completa de metas financieras personales y familiares.
 * Permite crear, editar y eliminar metas, registrar aportes de ahorro,
 * validar saldos disponibles y consultar el progreso de cada meta.
 * 
 * Funciones clave:
 * - Obtener metas personales y familiares del usuario
 * - Crear y editar metas financieras
 * - Eliminar metas existentes
 * - Registrar aportes de ahorro a metas
 * - Consultar saldo disponible del usuario
 * - Obtener historial de aportes por meta
 */

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN"
  }).format(amount);
};

export class GestorMetas { // GES-003

  /**
   * Crea una instancia del GestorMetas.
   *
   * @param {Object} supabase - Cliente de Supabase para operaciones de base de datos.
   * @param {Object} gestorUsuario - Instancia del GestorUsuario para obtener datos del usuario.
   */
  constructor(supabase, gestorUsuario) {
    this.supabase = supabase;
    this.gestorUsuario = gestorUsuario;
  }

  // MGES003-1
  /**
   * Obtiene todas las metas visibles para un usuario.
   * 
   * Se usa para: Listar metas en pantallas de visualización y gestión.
   * Incluye metas personales y metas familiares si el usuario pertenece a una familia.
   *
   * @async
   * @param {string} usuarioId - ID del usuario.
   * @returns {Promise<Array>} Array de metas visibles para el usuario.
   * @throws {Error} Si falla la consulta.
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

  // MGES003-2
  /**
   * Crea una nueva meta financiera.
   * 
   * Se usa para: Registrar una nueva meta desde formularios de creación.
   *
   * @async
   * @param {Object} params - Datos de la meta a crear.
   * @param {string} params.nombre - Nombre de la meta.
   * @param {number} params.monto_objetivo - Monto objetivo a alcanzar.
   * @param {string} params.fecha_limite - Fecha límite de la meta.
   * @param {string|null} params.familia_id - ID de la familia (si es meta familiar).
   * @param {string} params.usuario_id - ID del usuario creador.
   * @param {boolean} params.es_familiar - Indica si la meta es familiar o personal.
   * @returns {Promise<Object>} Meta creada.
   * @throws {Error} Si falla la creación.
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

  // MGES003-3
  /**
   * Edita una meta existente.
   * 
   * Se usa para: Actualizar datos de una meta desde formularios de edición.
   *
   * @async
   * @param {string} id - ID de la meta a editar.
   * @param {Object} params - Datos a actualizar.
   * @param {string} params.nombre - Nuevo nombre de la meta.
   * @param {number} params.monto_objetivo - Nuevo monto objetivo.
   * @param {string} params.fecha_limite - Nueva fecha límite.
   * @param {boolean} params.es_familiar - Nuevo estado de alcance (familiar/personal).
   * @returns {Promise<Object>} Meta actualizada.
   * @throws {Error} Si no se puede obtener el ID del usuario o falla la edición.
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

  // MGES003-4
  /**
   * Elimina una meta por su ID.
   * 
   * Se usa para: Remover metas desde interfaces de gestión.
   *
   * @async
   * @param {string} id - ID de la meta a eliminar.
   * @returns {Promise<boolean>} true si se eliminó correctamente.
   * @throws {Error} Si falla la eliminación.
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

  // MGES003-5
  /**
   * Registra un aporte de ahorro a una meta.
   * 
   * Se usa para: Aportar dinero a una meta desde formularios de ahorro.
   * Actualiza automáticamente el monto actual de la meta y el saldo disponible del usuario.
   *
   * @async
   * @param {string} metaId - ID de la meta.
   * @param {number} monto - Monto del aporte.
   * @param {string} usuarioId - ID del usuario que realiza el aporte.
   * @param {string|null} movimientoId - ID del movimiento asociado (opcional).
   * @returns {Promise<Object>} Registro del aporte creado.
   * @throws {Error} Si falla el registro del aporte.
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

  // MGES003-6
  /**
   * Obtiene el saldo disponible de un usuario.
   * 
   * Se usa para: Validar si el usuario tiene fondos suficientes antes de realizar aportes.
   *
   * @async
   * @param {string} usuarioId - ID del usuario.
   * @returns {Promise<number>} Saldo disponible del usuario.
   * @throws {Error} Si falla la consulta.
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

  // MGES003-7
  /**
   * Obtiene el historial de aportes de una meta específica.
   * 
   * Se usa para: Mostrar el detalle de aportes realizados en una meta.
   *
   * @async
   * @param {string} metaId - ID de la meta.
   * @returns {Promise<Array>} Array de aportes con información del usuario y movimiento asociado.
   * @throws {Error} Si falla la consulta.
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