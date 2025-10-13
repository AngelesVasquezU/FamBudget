export class GestorMetas { // COD005
  constructor(supabase) { // MCOD005-1
    this.supabase = supabase;
  }

  async obtenerMetas(usuarioId) { // MCOD005-2
    const { data, error } = await this.supabase 
      .from("metas")
      .select("*")
      .eq("usuario_id", usuarioId);
    if (error) throw error;
    return data;
  }
}
