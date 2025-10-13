export class GestorConcepto { // COD-003
  constructor(supabase) {
    this.supabase = supabase;
  }
  
  // MCOD003-1
  async obtenerConceptos() {
      const { data, error } = await this.supabase
        .from('conceptos')
        .select('*')
        .order('nombre', { ascending: true });
      if (error) throw error;
      return data;
  }

  // MCOD003-2
  async obtenerConceptosPorTipo(tipo) {
    const { data, error } = await this.supabase
      .from("conceptos")
      .select("*")
      .order("nombre", { ascending: true })
      .eq(tipo ? "tipo" : undefined, tipo);
    if (error) throw error;
    return data;
  }

  // MCOD003-3
  async existeNombre(nombre, ignorarId = null) {
    let query = this.supabase.from("conceptos").select("id").eq("nombre", nombre).limit(1);

    if (ignorarId) {
      query = query.neq("id", ignorarId);
    }

    const { data, error } = await query;
    if (error && error.code !== 'PGRST116') throw error;
    return !!(data && data.length > 0);
  }

  async crearConcepto({ nombre, tipo, periodo }) {
    const yaExiste = await this.existeNombre(nombre);
    if (yaExiste) throw new Error("El concepto ya existe");
    const { data, error } = await this.supabase
      .from("conceptos")
      .insert([{ nombre, tipo, periodo }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async editarConcepto(id, { nombre, tipo, periodo }) {
    const yaExiste = await this.existeNombre(nombre, id);
    if (yaExiste) throw new Error("Ya existe otro concepto con ese nombre");

    const { data, error } = await this.supabase
      .from('conceptos')
      .update({ nombre, tipo, periodo })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data;
  }
}
