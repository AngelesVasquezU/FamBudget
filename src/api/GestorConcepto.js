export class GestorConcepto { // GES-001
  constructor(supabase, gestorUsuario) {
    this.supabase = supabase;
    this.gestorUsuario = gestorUsuario;
  }
  
  // MGES001-1
  // Obtiene todos los conceptos asociados a la familia del usuario.
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

  // MGES001-2
  // Obtiene conceptos filtrados opcionalmente por tipo y por familia del usuario.
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

  // MGES001-3
  // Verifica si existe un concepto con el mismo nombre (opcionalmente ignorando un ID).
  async existeNombre(nombre, ignorarId = null) {
    let query = this.supabase.from("conceptos").select("id").eq("nombre", nombre).limit(1);

    if (ignorarId) {
      query = query.neq("id", ignorarId);
    }

    const { data, error } = await query;
    if (error && error.code !== 'PGRST116') throw error;
    return !!(data && data.length > 0);
  }

  // MGES001-4
  // Crea un nuevo concepto, asegurando que la familia del usuario exista.
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

  // MGES001-5
  // Verifica si un concepto existe dentro de una familia.
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

  // MGES001-6
  // Edita un concepto existente asegurando que no duplique nombres.
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
