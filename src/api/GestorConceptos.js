// GES-001
/**
 * GestorConceptos – Gestión de conceptos financieros
 *
 * Clase encargada de administrar todas las operaciones relacionadas con
 * los conceptos (categorías de ingreso/egreso) asociados a cada familia.
 *
 * Funcionalidades principales:
 * - Obtener conceptos del usuario y su familia
 * - Filtrar conceptos por tipo
 * - Validar nombres duplicados
 * - Crear conceptos (creando familia si no existe)
 * - Editar conceptos existentes
 */
export class GestorConceptos { // GES-001

  /**
   * Constructor del gestor de conceptos.
   *
   * @param {SupabaseClient} supabase - Instancia del cliente de Supabase.
   * @param {GestorUsuario} gestorUsuario - Gestor encargado de obtener datos del usuario.
   */
  constructor(supabase, gestorUsuario) {
    this.supabase = supabase;
    this.gestorUsuario = gestorUsuario;
  }

  // MGES001-1 — Obtener conceptos de la familia del usuario
  /**
   * Obtiene todos los conceptos asociados a la familia del usuario autenticado.
   *
   * Cada concepto incluye:
   * - nombre
   * - tipo (ingreso/egreso)
   * - periodo
   * - familia_id
   *
   * @returns {Promise<Array>} Lista de conceptos ordenados por nombre.
   * @throws {Error} Si no se puede identificar al usuario o si falla la consulta.
   */
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

  // MGES001-2 — Obtener conceptos filtrados por tipo
  /**
   * Obtiene los conceptos filtrados opcionalmente por tipo.
   *
   * Si el usuario pertenece a una familia, solo se retornan los conceptos
   * de esa familia. 
   *
   * @param {string|null} tipo - "ingreso" | "egreso".
   * @returns {Promise<Array>} Conceptos filtrados.
   * @throws {Error} Si falla la consulta o no se encuentra el usuario.
   */
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

    if (tipo) query = query.eq("tipo", tipo);

    const { data, error } = await query;
    if (error) throw error;

    return data;
  }

  // MGES001-3 — Verificar duplicado dentro de familia
  /**
   * Verifica si un concepto existe dentro de una familia específica.
   *
   * @param {string} nombre - Nombre del concepto.
   * @param {string} familia_id - Familia donde buscar.
   * @param {string|null} ignorarId - ID opcional a ignorar.
   * @returns {Promise<boolean>}
   */
  async existeNombreEnFamilia(nombre, familia_id, ignorarId = null) {
    let query = this.supabase
      .from("conceptos")
      .select("id")
      .eq("nombre", nombre)
      .eq("familia_id", familia_id)
      .limit(1);

    if (ignorarId) query = query.neq("id", ignorarId);

    const { data, error } = await query;
    if (error && error.code !== 'PGRST116') throw error;

    return !!(data && data.length > 0);
  }

  // MGES001-4 — Crear un nuevo concepto
  /**
   * Crea un nuevo concepto para la familia del usuario.
   * 
   * @param {Object} params
   * @param {string} params.nombre - Nombre del concepto.
   * @param {"ingreso"|"egreso"} params.tipo - Tipo del concepto.
   * @param {string|null} params.periodo - Periodo asociado (opcional).
   *
   * @returns {Promise<Object>} Concepto creado.
   * @throws {Error} Si ya existe o si falla alguna operación.
   */
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
        .insert([{ nombre: `Familia de ${usuario.nombre || 'Usuario'}` }])
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

    // Validar duplicado
    const yaExiste = await this.existeNombreEnFamilia(nombre, familia_id);
    if (yaExiste) throw new Error("El concepto ya existe en esta familia");

    // Crear concepto
    const { data, error } = await this.supabase
      .from("conceptos")
      .insert([{ nombre, tipo, periodo, familia_id }])
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // MGES001-5 — Editar un concepto
  /**
   * Edita un concepto existente validando que no exista otro
   * con el mismo nombre dentro de la misma familia.
   *
   * @param {string} id - ID del concepto.
   * @param {Object} params
   * @param {string} params.nombre
   * @param {"ingreso"|"egreso"} params.tipo
   * @param {string|null} params.periodo
   *
   * @returns {Promise<Object>} Concepto actualizado.
   * @throws {Error} Si ya existe duplicado o falla Supabase.
   */
  async editarConcepto(id, { nombre, tipo, periodo }) {
    // Obtener familia del concepto actual
    const { data: conceptoActual, error: errorConcepto } = await this.supabase
      .from("conceptos")
      .select("familia_id")
      .eq("id", id)
      .single();

    if (errorConcepto) throw errorConcepto;
    if (!conceptoActual) throw new Error("Concepto no encontrado");

    const familia_id = conceptoActual.familia_id;

    // Validar duplicado dentro de la misma familia
    const yaExiste = await this.existeNombreEnFamilia(nombre, familia_id, id);
    if (yaExiste) throw new Error("Ya existe otro concepto con ese nombre en esta familia");

    const { data, error } = await this.supabase
      .from("conceptos")
      .update({ nombre, tipo, periodo })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }
}
