export class GestorUsuario { // COD-006
  constructor(supabase) { // MCOD006-1
    this.supabase = supabase;
  }

  async obtenerIdUsuario() {  // MCOD006-2
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

  async obtenerUsuario() { // MCOD006-3
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
}
