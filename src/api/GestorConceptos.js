// GES-001
/**
 * GES-001 — GestorConceptos
 * 
 * Gestión de conceptos financieros de la familia del usuario.
 * Centraliza todas las operaciones relacionadas con la creación, consulta y edición
 * de conceptos de ingresos y egresos.
 * 
 * Funciones clave:
 * - Obtener todos los conceptos de la familia
 * - Filtrar conceptos por tipo (ingreso/egreso)
 * - Crear nuevos conceptos
 * - Editar conceptos existentes
 */

export class GestorConceptos { // GES-001

  /**
   * Crea una instancia del GestorConceptos.
   * 
   * @param {Object} supabase - Cliente de Supabase para operaciones de base de datos.
   * @param {Object} gestorUsuario - Instancia del GestorUsuario para obtener datos del usuario.
   */
  constructor(supabase, gestorUsuario) {
    this.supabase = supabase;
    this.gestorUsuario = gestorUsuario;
  }

  /**
   * Obtiene todos los conceptos de la familia del usuario autenticado.
   * 
   * Se usa para: Listar conceptos disponibles en formularios y pantallas de configuración.
   * 
   * @async
   * @returns {Promise<Array>} Array de conceptos ordenados por nombre.
   * @throws {Error} Si no se puede obtener el ID del usuario o falla la consulta.
   */
  async obtenerConceptos() {
    const userId = await this.gestorUsuario.obtenerIdUsuario();
    if (!userId) throw new Error("No se pudo obtener el ID del usuario");

    const { data, error } = await this.supabase.rpc("obtener_conceptos", {
      p_usuario_id: userId
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Obtiene conceptos filtrados por tipo.
   * 
   * Se usa para: Mostrar solo ingresos o egresos en formularios específicos.
   * 
   * @async
   * @param {"ingreso"|"egreso"|null} tipo - Tipo de concepto a filtrar, o null para todos.
   * @returns {Promise<Array>} Array de conceptos del tipo especificado.
   * @throws {Error} Si no se puede obtener el ID del usuario o falla la consulta.
   */
  async obtenerConceptosPorTipo(tipo = null) {
    const userId = await this.gestorUsuario.obtenerIdUsuario();
    if (!userId) throw new Error("No se pudo obtener el ID del usuario");

    const { data, error } = await this.supabase.rpc("obtener_conceptos_por_tipo", {
      p_usuario_id: userId,
      p_tipo: tipo
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Crea un nuevo concepto en la familia del usuario.
   * 
   * Se usa para: Agregar conceptos personalizados desde configuración o formularios.
   * 
   * @async
   * @param {Object} params - Datos del concepto a crear.
   * @param {string} params.nombre - Nombre del concepto.
   * @param {"ingreso"|"egreso"} params.tipo - Tipo de concepto.
   * @param {string|null} params.periodo - Periodo del concepto (opcional).
   * @returns {Promise<Object>} Concepto creado.
   * @throws {Error} Si no se puede obtener el ID del usuario o falla la creación.
   */
  async crearConcepto({ nombre, tipo, periodo }) {
    const userId = await this.gestorUsuario.obtenerIdUsuario();

    const { data, error } = await this.supabase.rpc("crear_concepto", {
      p_usuario_id: userId,
      p_nombre: nombre,
      p_tipo: tipo,
      p_periodo: periodo
    });

    if (error) throw error;
    return data;
  }

  /**
   * Edita un concepto existente.
   * 
   * Se usa para: Actualizar nombre, tipo o periodo de un concepto desde configuración.
   * 
   * @async
   * @param {string} id - ID del concepto a editar.
   * @param {Object} params - Datos a actualizar.
   * @param {string} params.nombre - Nuevo nombre del concepto.
   * @param {"ingreso"|"egreso"} params.tipo - Nuevo tipo de concepto.
   * @param {string|null} params.periodo - Nuevo periodo del concepto (opcional).
   * @returns {Promise<Object>} Concepto actualizado.
   * @throws {Error} Si falla la actualización.
   */
  async editarConcepto(id, { nombre, tipo, periodo }) {
    const { data, error } = await this.supabase.rpc("editar_concepto", {
      p_concepto_id: id,
      p_nombre: nombre,
      p_tipo: tipo,
      p_periodo: periodo
    });

    if (error) throw error;
    return data;
  }
}