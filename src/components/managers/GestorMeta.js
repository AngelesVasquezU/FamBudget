export class GestorMetas {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async obtenerMetas(usuarioId) {
    const { data, error } = await this.supabase
      .from("metas")
      .select("*")
      .eq("usuario_id", usuarioId);
    if (error) throw error;
    return data;
  }
}
