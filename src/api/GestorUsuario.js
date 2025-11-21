export class GestorUsuario { // GES-005
  constructor(supabase) {
    this.supabase = supabase;
  }

  // MGES005-1
  // Obtiene el ID interno del usuario en la tabla "usuarios",
  // a partir del auth_id proporcionado por Supabase Auth.
  async obtenerIdUsuario() {
    try {
      const { data: authData, error } = await this.supabase.auth.getUser();
      if (error) throw error;
      const authId = authData.user?.id;
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
  // Retorna el registro completo del usuario en la tabla "usuarios"
  // según su auth_id de Supabase.
  async obtenerUsuario() {
    try {
      const { data: authData, error } = await this.supabase.auth.getUser();
      if (error) throw error;
      const authId = authData.user?.id;
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
  // Obtiene todos los miembros que pertenecen a la misma familia
  // que el usuario actualmente autenticado.
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
}
