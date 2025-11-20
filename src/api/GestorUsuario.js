export class GestorUsuario { // COD-006
  constructor(supabase) { // MCOD006-1
    this.supabase = supabase;
  }

  // MCOD006-2
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

  // MCOD006-3
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

  // MCOD006-4
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
