export class GestorConcepto { // COD-003
  constructor(supabase, gestorUsuario) {
    this.supabase = supabase;
    this.gestorUsuario = gestorUsuario;
  }
  
  // MCOD003-1
  async obtenerConceptos() {
    const user_id = await this.gestorUsuario.obtenerIdUsuario();
    if (!user_id) throw new Error("No se pudo obtener el ID del usuario");

    const { data: usuario, error: errorUsuario } = await this.supabase
      .from('usuarios')
      .select('familia_id')
      .eq('id', user_id)
      .single();

    if (errorUsuario) throw errorUsuario;
    if (!usuario) throw new Error('Usuario no encontrado');

    const { data: conceptos, error: errorConceptos } = await this.supabase
      .from('conceptos')
      .select('*')
      .eq('familia_id', usuario.familia_id)
      .order('nombre', { ascending: true });

    if (errorConceptos) throw errorConceptos;
    return conceptos;
  }

  // MCOD003-2
  async obtenerConceptosPorTipo(tipo) {    
    const user_id = await this.gestorUsuario.obtenerIdUsuario();
    if (!user_id) throw new Error("No se pudo obtener el ID del usuario");

    const { data: usuario, error: errorUsuario } = await this.supabase
      .from('usuarios')
      .select('familia_id')
      .eq('id', user_id)
      .single();
    
    if (errorUsuario) throw errorUsuario;
    if (!usuario) throw new Error('Usuario no encontrado');
    
    let query = this.supabase
      .from("conceptos")
      .select("*")
      .order("nombre", { ascending: true });

    if (usuario.familia_id) {
      query = query.eq('familia_id', usuario.familia_id);
    } else {
      query = query.is('familia_id', null);
    }

    if (tipo) {
      query = query.eq("tipo", tipo);
    }

    const { data, error } = await query;
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
    const user_id = await this.gestorUsuario.obtenerIdUsuario();
    if (!user_id) throw new Error("No se pudo obtener el ID del usuario");

    let { data: usuario, error: errorUsuario } = await this.supabase
      .from('usuarios')
      .select('familia_id, nombre')
      .eq('id', user_id)
      .single();
    
    if (errorUsuario) throw errorUsuario;
    if (!usuario) throw new Error('Usuario no encontrado');
    
    let familia_id = usuario.familia_id;
    
    if (!familia_id) {
      const { data: nuevaFamilia, error: errorFamilia } = await this.supabase
        .from('familias')
        .insert([{ 
          nombre: `Familia de ${usuario.nombre || 'Usuario'}`
        }])
        .select()
        .single();
        
      if (errorFamilia) throw errorFamilia;
      
      const { error: errorUpdate } = await this.supabase
        .from('usuarios')
        .update({ familia_id: nuevaFamilia.id })
        .eq('id', user_id);
        
      if (errorUpdate) throw errorUpdate;
      
      familia_id = nuevaFamilia.id;
    }

    const yaExiste = await this.existeNombreEnFamilia(nombre, familia_id);
    if (yaExiste) throw new Error("El concepto ya existe en esta familia");
    
    const { data, error } = await this.supabase
      .from("conceptos")
      .insert([{ 
        nombre, 
        tipo, 
        periodo,
        familia_id: familia_id
      }])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async existeNombreEnFamilia(nombre, familia_id, ignorarId = null) {
    let query = this.supabase
      .from("conceptos")
      .select("id")
      .eq("nombre", nombre)
      .eq("familia_id", familia_id)
      .limit(1);

    if (ignorarId) {
      query = query.neq("id", ignorarId);
    }

    const { data, error } = await query;
    if (error && error.code !== 'PGRST116') throw error;
    return !!(data && data.length > 0);
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
