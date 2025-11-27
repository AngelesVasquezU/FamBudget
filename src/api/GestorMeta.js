/**
 * GestorMetas
 * ------------
 * Módulo encargado de administrar todo lo relacionado a las metas financieras:
 * - Creación, edición y eliminación de metas
 * - Registro de aportes de ahorro
 * - Validación de saldos
 * - Actualización de progreso de metas
 * - Obtención de metas personales y familiares
 *
 * Identificador del módulo: GES-003
 *
 * Este gestor es clave para la administración del ahorro, pues interactúa con:
 * - la tabla `metas`
 * - la tabla `usuarios`
 * - la tabla `ahorro`
 *
 * Cada operación incluye validaciones y actualizaciones necesarias para
 * asegurar consistencia en los montos ahorrados y el saldo disponible.
 */

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
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

  // ============================================================
  // MGES003-1 — Obtener metas visibles por usuario
  // ============================================================

  /**
   * Obtiene todas las metas visibles para un usuario:
   * - sus metas personales
   * - metas familiares (si pertenece a una familia)
   *
   * @param {string} usuarioId - ID del usuario.
   * @returns {Promise<Array>} Lista de metas visibles.
   */
  async obtenerMetas(usuarioId) {
    try {
      const { data: usuario, error: errorUsuario } = await this.supabase
        .from("usuarios")
        .select("familia_id")
        .eq("id", usuarioId)
        .single();

      if (errorUsuario) throw errorUsuario;

      const familiaId = usuario?.familia_id || null;

      let query = this.supabase
        .from("metas")
        .select(`
          *,
          usuarios:usuario_id(nombre)
        `);

      // Si tiene familia → mostrar metas personales y familiares
      if (familiaId) {
        query = query.or(
          `usuario_id.eq.${usuarioId},familia_id.eq.${familiaId}`
        );
      } else {
        query = query.eq("usuario_id", usuarioId);
      }

      const { data, error } = await query.order("fecha_creacion", {
        ascending: false,
      });

      if (error) throw error;

      return data;

    } catch (error) {
      console.error("Error en obtenerMetas:", error);
      throw error;
    }
  }

  // ============================================================
  // MGES003-2 — Crear una nueva meta
  // ============================================================

  /**
   * Crea una nueva meta de ahorro.
   *
   * Puede ser:
   * - Personal → usuario_id se llena
   * - Familiar → familia_id se llena
   *
   * @param {Object} params
   * @param {string} params.nombre
   * @param {number} params.monto_objetivo
   * @param {string} params.fecha_limite - YYYY-MM-DD
   * @param {string|null} params.familia_id
   * @param {string|null} params.usuario_id
   * @param {boolean} params.es_familiar
   *
   * @returns {Promise<Object>} Meta creada.
   */
  async crearMeta({ nombre, monto_objetivo, fecha_limite, familia_id, usuario_id, es_familiar = false }) {
    try {
      const { data, error } = await this.supabase
        .from("metas")
        .insert([{
          nombre,
          monto_objetivo,
          fecha_limite,
          familia_id,
          usuario_id,
          es_familiar,
          monto_actual: 0
        }])
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      console.error('Error en crearMeta:', error);
      throw error;
    }
  }

  // ============================================================
  // MGES003-3 — Editar meta existente
  // ============================================================

  /**
   * Edita una meta existente.
   *
   * Si se convierte en meta familiar o personal,
   * actualiza correctamente:
   * - usuario_id
   * - familia_id
   *
   * @param {string} id - ID de la meta.
   * @param {Object} params
   * @param {string} params.nombre
   * @param {number} params.monto_objetivo
   * @param {string} params.fecha_limite
   * @param {boolean} params.es_familiar
   *
   * @returns {Promise<Object>} Meta actualizada.
   */
  async editarMeta(id, { nombre, monto_objetivo, fecha_limite, es_familiar }) {
    try {
      const user_id = await this.gestorUsuario.obtenerIdUsuario();
      if (!user_id) throw new Error("No se pudo obtener el ID del usuario");

      const { data: usuario, error: errorUsuario } = await this.supabase
        .from('usuarios')
        .select('familia_id')
        .eq('id', user_id)
        .single();

      if (errorUsuario) throw errorUsuario;
      if (!usuario) throw new Error('Usuario no encontrado');

      const familia_id = usuario.familia_id;

      const updateData = {
        nombre,
        monto_objetivo,
        fecha_limite,
        es_familiar,
        familia_id: es_familiar ? familia_id : null,
        usuario_id: es_familiar ? null : user_id
      };

      const { data, error } = await this.supabase
        .from("metas")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      console.error('Error en editarMeta:', error);
      throw error;
    }
  }

  // ============================================================
  // MGES003-4 — Eliminar meta
  // ============================================================

  /**
   * Elimina una meta del sistema.
   *
   * ⚠ Importante: No elimina registros de ahorro asociados.
   *
   * @param {string} id - ID de la meta.
   * @returns {Promise<boolean>}
   */
  async eliminarMeta(id) {
    const { error } = await this.supabase
      .from("metas")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return true;
  }

  // ============================================================
  // MGES003-5 — Agregar ahorro (aporte)
  // ============================================================

  /**
   * Registra un aporte a una meta, actualizando:
   * - monto_actual de la meta
   * - saldo_disponible del usuario
   * - registro en la tabla ahorro
   *
   * Incluye validaciones:
   * - que haya saldo suficiente
   * - que no supere la meta
   *
   * @param {string} metaId
   * @param {number} monto
   * @param {string} usuarioId
   * @param {string|null} movimientoId
   *
   * @returns {Promise<Object>} Información del nuevo estado de la meta.
   */
  async agregarAhorro(metaId, monto, usuarioId, movimientoId = null) {
    try {
      if (!metaId || !usuarioId || !monto || monto <= 0) {
        throw new Error("Parámetros inválidos para el aporte");
      }

      const saldoDisponible = await this.obtenerSaldoDisponible(usuarioId);

      if (monto > saldoDisponible) {
        throw new Error(
          `Ingresos insuficientes. Disponible: ${formatCurrency(saldoDisponible)}`
        );
      }

      const { data: meta, error: metaError } = await this.supabase
        .from("metas")
        .select("monto_actual, monto_objetivo, nombre")
        .eq("id", metaId)
        .single();

      if (metaError) throw new Error("Meta no encontrada");

      const nuevoMonto = parseFloat(meta.monto_actual) + parseFloat(monto);

      if (nuevoMonto > meta.monto_objetivo) {
        throw new Error(
          `El aporte excede el objetivo. Máximo permitido: ${formatCurrency(
            meta.monto_objetivo - meta.monto_actual
          )}`
        );
      }

      // Actualizar meta
      const { error: updateMetaError } = await this.supabase
        .from("metas")
        .update({ monto_actual: nuevoMonto })
        .eq("id", metaId);

      if (updateMetaError) throw updateMetaError;

      // Actualizar saldo disponible
      const nuevoSaldo = saldoDisponible - monto;

      const { error: updateSaldoError } = await this.supabase
        .from("usuarios")
        .update({ saldo_disponible: nuevoSaldo })
        .eq("id", usuarioId);

      if (updateSaldoError) throw updateSaldoError;

      // Registrar aporte
      const { error: aporteError } = await this.supabase
        .from("ahorro")
        .insert([{
          meta_id: metaId,
          movimiento_id: movimientoId,
          monto: parseFloat(monto),
        }]);

      if (aporteError) throw aporteError;

      return {
        exito: true,
        nuevoSaldo,
        nuevoMonto,
        mensaje: "Aporte registrado correctamente",
      };

    } catch (error) {
      console.error("Error en agregarAhorro:", error);
      throw error;
    }
  }

  // ============================================================
  // MGES003-6 — Obtener saldo disponible del usuario
  // ============================================================

  /**
   * Obtiene el saldo disponible del usuario para asignar a metas.
   *
   * Este campo se actualiza cada vez que un ingreso se modifica o
   * se asigna dinero a una meta.
   *
   * @param {string} usuarioId
   * @returns {Promise<number>} Saldo actual.
   */
  async obtenerSaldoDisponible(usuarioId) {
    try {
      const { data, error } = await this.supabase
        .from("usuarios")
        .select("saldo_disponible")
        .eq("id", usuarioId)
        .single();

      if (error) throw error;

      return parseFloat(data?.saldo_disponible) || 0;

    } catch (err) {
      console.error("Error al obtener saldo disponible:", err);
      throw new Error("No se pudo obtener el saldo disponible del usuario");
    }
  }

  // ============================================================
  // MGES003-7 — Obtener aportes de una meta
  // ============================================================

  /**
   * Obtiene todos los aportes registrados a una meta.
   *
   * Incluye JOINs con:
   * - movimientos
   * - usuarios
   *
   * @param {string} metaId
   * @returns {Promise<Array>} Lista de aportes.
   */
  async obtenerAportesPorMeta(metaId) {
    try {
      const { data, error } = await this.supabase
        .from("ahorro")
        .select(`
          id,
          monto,
          fecha_aporte,
          movimiento:movimiento_id (
            id,
            monto,
            tipo,
            fecha,
            usuario:usuario_id (
              id,
              nombre,
              correo
            )
          )
        `)
        .eq("meta_id", metaId)
        .order("fecha_aporte", { ascending: false });

      if (error) throw error;

      return data;

    } catch (error) {
      console.error("Error en obtenerAportes:", error);
      throw error;
    }
  }

}
