export class GestorUsuario {
  constructor(supabase) {
    this.supabase = supabase;
  }

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
      console.error("UserManager error:", err);
      return null;
    }
  }
}
