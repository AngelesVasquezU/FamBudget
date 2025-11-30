// GES-005
/**
 * GES-005 — GestorUsuario
 * 
 * Gestión de usuarios registrados en la tabla "usuarios".
 * Provee operaciones para consultar y actualizar información del usuario autenticado
 * y miembros de su familia.
 * 
 * Funciones clave:
 * - Obtener ID interno del usuario desde auth_id
 * - Recuperar información completa del usuario
 * - Listar miembros de la misma familia
 * - Actualizar datos del usuario
 */

export class GestorUsuario {

  /**
   * Crea una instancia del GestorUsuario.
   * 
   * @param {Object} supabase - Cliente de Supabase para operaciones de base de datos.
   * @param {Object} gestorAuth - Instancia del GestorAuth para obtener datos de autenticación.
   */
  constructor(supabase, gestorAuth) {
    this.supabase = supabase;
    this.gestorAuth = gestorAuth;
  }

  // MGES005-1
  /**
   * Obtiene el ID interno del usuario en la tabla "usuarios".
   * 
   * Se usa para: Obtener el identificador numérico del usuario a partir de su auth_id.
   * 
   * @async
   * @returns {Promise<number|null>} ID del usuario o null si no existe o no está autenticado.
   */
  async obtenerIdUsuario() {
    const { data: authData } = await this.gestorAuth.getUser();
    const authId = authData?.user?.id;
    if (!authId) return null;

    const { data, error } = await this.supabase.rpc("obtener_id_usuario", {
      p_auth_id: authId
    });

    if (error) return null;
    return data;
  }


  // MGES005-2
  /**
   * Obtiene el registro completo del usuario autenticado.
   * 
   * Se usa para: Consultar toda la información del perfil del usuario actual.
   * 
   * @async
   * @returns {Promise<Object|null>} Objeto con los datos del usuario o null si no existe.
   */
  async obtenerUsuario() {
    const { data: authData } = await this.gestorAuth.getUser();
    const authId = authData?.user?.id;

    if (!authId) return null;

    const { data, error } = await this.supabase.rpc("obtener_usuario", {
      p_auth_id: authId
    });

    if (error) return null;
    return data;
  }


  // MGES005-3
  /**
   * Lista todos los usuarios que pertenecen a la familia del usuario autenticado.
   * 
   * Se usa para: Mostrar miembros del grupo familiar en interfaces de gestión familiar.
   * 
   * @async
   * @returns {Promise<Array>} Array de objetos usuario de la misma familia.
   * @throws {Error} Si ocurre un error en la consulta.
   */
  async obtenerUsuariosDeMiFamilia() {
    const user = await this.obtenerUsuario();
    if (!user?.familia_id) return [];

    const { data, error } = await this.supabase.rpc("obtener_usuarios_de_familia", {
      p_familia_id: user.familia_id
    });

    if (error) throw error;
    return data;
  }

  // MGES005-4
  /**
   * Actualiza los datos de un usuario específico.
   * 
   * Se usa para: Modificar información del perfil como nombre o parentesco.
   * 
   * @async
   * @param {number|string} usuarioId - ID del usuario a actualizar.
   * @param {Object} datos - Objeto con los campos a modificar.
   * @param {string} [datos.nombre] - Nuevo nombre del usuario.
   * @param {string} [datos.parentesco] - Nuevo parentesco del usuario.
   * @returns {Promise<Object>} Usuario actualizado con los nuevos datos.
   * @throws {Error} Si ocurre un error en la actualización.
   */
  async actualizarUsuario(usuarioId, datos) {
    const { nombre, parentesco } = datos;

    const { data, error } = await this.supabase.rpc("actualizar_usuario", {
      p_usuario_id: usuarioId,
      p_nombre: nombre || null,
      p_parentesco: parentesco || null
    });

    if (error) throw error;
    return data;
  }


}