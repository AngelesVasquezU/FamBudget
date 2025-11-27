// GES-005
/**
 * GestorUsuario – Gestión de usuarios en la tabla "usuarios".
 *
 * Funcionalidades:
 *  - Obtener el ID interno del usuario (tabla "usuarios")
 *  - Recuperar su información completa
 *  - Listar miembros de su misma familia
 *
 * Toda la información del usuario autenticado se obtiene a través
 * del GestorAuth.
 */

export class GestorUsuario {

  /**
   * @param {Object} supabase - Instancia del cliente de Supabase.
   */
  constructor(supabase, gestorAuth) {
    this.supabase = supabase;
    this.gestorAuth = gestorAuth;
  }

  // MGES005-1
  /**
   * Obtiene el ID interno del usuario en la tabla "usuarios"
   * a partir del auth_id de Supabase Authentication.
   *
   * @async
   * @returns {Promise<number|null>} ID del usuario o null si no existe.
   */
  async obtenerIdUsuario() {
    try {
      const { data: authData } = await this.gestorAuth.getUser();
      const authId = authData?.user?.id;

      if (!authId) return null;

      const { data: usuario, error: usuarioError } = await this.supabase
        .from("usuarios")
        .select("id")
        .eq("auth_id", authId)
        .single();

      if (usuarioError || !usuario) return null;

      return usuario.id;

    } catch (err) {
      console.error("GestorUsuario error:", err);
      return null;
    }
  }

  // MGES005-2
  /**
   * Retorna el registro completo del usuario en la tabla "usuarios",
   * basado en el auth_id del usuario autenticado.
   *
   * @async
   * @returns {Promise<Object|null>} Información del usuario o null si no existe.
   */
  async obtenerUsuario() {
    try {
      const { data: authData } = await this.gestorAuth.getUser();
      const authId = authData?.user?.id;

      if (!authId) return null;

      const { data: usuario, error: usuarioError } = await this.supabase
        .from("usuarios")
        .select("*")
        .eq("auth_id", authId)
        .single();

      if (usuarioError || !usuario) return null;

      return usuario;

    } catch (err) {
      console.error("GestorUsuario error:", err);
      return null;
    }
  }

  // MGES005-3
  /**
   * Obtiene la lista de usuarios que pertenecen a la misma familia
   * que el usuario actualmente autenticado.
   *
   * @async
   * @returns {Promise<Array>} Lista de miembros de la familia.
   */
  async obtenerUsuariosDeMiFamilia() {
    const user = await this.obtenerUsuario();
    if (!user || !user.familia_id) return [];

    const { data, error } = await this.supabase
      .from("usuarios")
      .select("id, nombre, correo, rol")
      .eq("familia_id", user.familia_id);

    if (error) throw error;

    return data;
  }

  // MGES005-4 — Actualizar Usuario
  /**
   * Actualiza los datos del usuario en la tabla "usuarios".
   *
   * @param {number|string} usuarioId - ID del usuario a actualizar.
   * @param {Object} datos - Campos a actualizar.
   * @param {string} [datos.nombre] - Nuevo nombre del usuario.
   * @param {string} [datos.parentesco] - Nuevo parentesco.
   *
   * @returns {Promise<Object>} Usuario actualizado.
   * @throws {Error} Si ocurre un error al actualizar.
   */
  async actualizarUsuario(usuarioId, datos) {
    try {
      const { data, error } = await this.supabase
        .from("usuarios")
        .update({
          nombre: datos.nombre?.trim(),
          parentesco: datos.parentesco?.trim()
        })
        .eq("id", usuarioId)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (err) {
      console.error("GestorUsuario.actualizarUsuario error:", err);
      throw err;
    }
  }

}
