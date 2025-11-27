/**
 * GestorFamilia
 * -------------
 * Responsable de administrar toda la lógica relacionada a:
 * - Familias
 * - Miembros de familia
 * - Roles dentro de la familia
 * - Parentesco
 *
 * Identificador del módulo: GES-002
 *
 * Funciones clave:
 * - Crear familia
 * - Obtener familia del usuario actual
 * - Agregar o eliminar miembros
 * - Transferir rol de administrador
 * - Eliminar familia completa
 *
 * Este gestor sirve como puente entre la capa de interfaz (vistas)
 * y las tablas relacionadas:
 *  - familias
 *  - usuarios
 *
 * Todas las funciones retornan datos limpios o errores claros
 * para su uso en la UI.
 */

export class GestorFamilia { // GES-002

    /**
     * Constructor del gestor.
     *
     * @param {SupabaseClient} supabase - Instancia del cliente de Supabase.
     * @param {GestorUsuario} gestorUsuario - Gestor encargado de datos del usuario.
     */
    constructor(supabase, gestorUsuario) {
        this.supabase = supabase;
        this.gestorUsuario = gestorUsuario;
    }

    // ============================================================
    // MGES002-1 — Obtener Mi Familia
    // ============================================================

    /**
     * Obtiene la información de la familia a la que pertenece
     * el usuario autenticado.
     *
     * @returns {Promise<Object|null>} Objeto familia o null si no pertenece a ninguna.
     * @throws Error si ocurre un problema en la consulta.
     */
    async obtenerMiFamilia() {
        const user = await this.gestorUsuario.obtenerUsuario();
        if (!user || !user.familia_id) return null;

        const { data, error } = await this.supabase
            .from('familias')
            .select('*')
            .eq('id', user.familia_id)
            .single();

        if (error) throw error;
        return data;
    }

    // ============================================================
    // MGES002-2 — Obtener Miembros de la Familia
    // ============================================================

    /**
     * Obtiene todos los miembros pertenecientes a una familia específica.
     *
     * @param {string} familia_id - ID de la familia.
     * @returns {Promise<Array>} Lista de miembros.
     * @throws Error si ocurre un fallo en la consulta.
     */
    async obtenerMiembros(familia_id) {
        const { data, error } = await this.supabase
            .from('usuarios')
            .select('id, nombre, correo, rol, parentesco')
            .eq('familia_id', familia_id);

        if (error) throw error;
        return data;
    }

    // ============================================================
    // MGES002-3 — Crear Familia
    // ============================================================

    /**
     * Crea un grupo familiar y asigna automáticamente al usuario
     * actual como miembro de esta.
     *
     * @param {string} nombre - Nombre de la familia.
     * @returns {Promise<Object>} La familia creada.
     * @throws Error si no hay usuario autenticado o falla la creación.
     */
    async crearFamilia(nombre) {
        const user = await this.gestorUsuario.obtenerUsuario();
        if (!user) throw new Error("No hay usuario autenticado");

        const { data: familia, error: errorFamilia } = await this.supabase
            .from('familias')
            .insert([{ nombre }])
            .select()
            .single();

        if (errorFamilia) throw errorFamilia;

        const { error: errorUpdate } = await this.supabase
            .from('usuarios')
            .update({ familia_id: familia.id })
            .eq('id', user.id);

        if (errorUpdate) throw errorUpdate;

        return familia;
    }

    // ============================================================
    // MGES002-4 — Agregar Miembro
    // ============================================================

    /**
     * Agrega un usuario existente (identificado por correo) a una familia.
     *
     * Validaciones:
     * - El usuario debe existir.
     * - No puede ser administrador.
     * - No puede pertenecer a otra familia.
     *
     * @param {string} familia_id - ID de la familia.
     * @param {string} correo - Correo del usuario a agregar.
     * @returns {Promise<boolean>} true si la operación fue exitosa.
     */
    async agregarMiembro(familia_id, correo) {
        const { data: usuario, error: errorUser } = await this.supabase
            .from('usuarios')
            .select('id, rol, familia_id')
            .eq('correo', correo)
            .single();

        if (errorUser || !usuario) throw new Error('Usuario no encontrado');

        if (usuario.rol === 'Administrador') {
            throw new Error('No puedes agregar un administrador al grupo familiar');
        }

        if (usuario.familia_id && usuario.familia_id !== familia_id) {
            throw new Error('Este usuario ya pertenece a otra familia');
        }

        const { error } = await this.supabase
            .from('usuarios')
            .update({ familia_id })
            .eq('id', usuario.id);

        if (error) throw error;

        return true;
    }

    // ============================================================
    // MGES002-5 — Actualizar Parentesco
    // ============================================================

    /**
     * Actualiza el parentesco de un usuario dentro de una familia.
     *
     * @param {string} usuario_id - ID del usuario.
     * @param {string} nuevoParentesco - Nuevo parentesco.
     * @returns {Promise<boolean>}
     */
    async actualizarParentesco(usuario_id, nuevoParentesco) {
        const { error } = await this.supabase
            .from('usuarios')
            .update({ parentesco: nuevoParentesco })
            .eq('id', usuario_id);

        if (error) throw error;
        return true;
    }

    // ============================================================
    // MGES002-6 — Eliminar Miembro
    // ============================================================

    /**
     * Elimina a un usuario de una familia.
     * No permite que la administradora se elimine a sí misma.
     *
     * @param {string} usuarioId - ID del usuario a eliminar.
     * @returns {Promise<boolean>}
     */
    async eliminarMiembro(usuarioId) {
        const currentUserId = await this.gestorUsuario.obtenerIdUsuario();

        if (usuarioId === currentUserId) {
            throw new Error('No puedes eliminarte a ti misma como administradora');
        }

        const { error } = await this.supabase
            .from('usuarios')
            .update({ familia_id: null, parentesco: null })
            .eq('id', usuarioId);

        if (error) throw error;
        return true;
    }

    // ============================================================
    // MGES002-7 — Transferir Rol de Administrador
    // ============================================================

    /**
     * Cambia el rol de administrador de una familia hacia otro usuario.
     * El nuevo administrador debe ser miembro de la familia.
     *
     * @param {string} familia_id - ID de la familia.
     * @param {string} nuevoAdminId - ID del nuevo administrador.
     * @param {string} adminActualId - ID del administrador actual.
     * @returns {Promise<boolean>}
     */
    async cambiarRolAdmin(familia_id, nuevoAdminId, adminActualId) {
        const { data: miembro, error: errorMiembro } = await this.supabase
            .from("usuarios")
            .select("familia_id, rol")
            .eq("id", nuevoAdminId)
            .single();

        if (errorMiembro || !miembro) throw new Error("Miembro no encontrado");
        if (miembro.familia_id !== familia_id)
            throw new Error("El usuario no pertenece a esta familia");

        // Asignar nuevo administrador
        const { error: err1 } = await this.supabase
            .from("usuarios")
            .update({ rol: "Administrador" })
            .eq("id", nuevoAdminId);

        // Degradar admin actual
        const { error: err2 } = await this.supabase
            .from("usuarios")
            .update({ rol: "Miembro familiar" })
            .eq("id", adminActualId);

        if (err1 || err2) throw new Error("Error al cambiar el rol");

        return true;
    }

    // ============================================================
    // MGES002-8 — Eliminar Familia
    // ============================================================

    /**
     * Elimina completamente una familia del sistema.
     * Solo la administradora puede hacerlo.
     *
     * Efectos:
     * - Todos los miembros quedan sin familia.
     * - Se elimina el registro en la tabla "familias".
     *
     * @returns {Promise<boolean>}
     */
    async eliminarFamilia() {
        const user = await this.gestorUsuario.obtenerUsuario();
        if (!user) throw new Error("No hay usuario autenticado");
        if (!user.familia_id) throw new Error("No perteneces a ninguna familia");

        if (user.rol !== "Administrador") {
            throw new Error("Solo el administrador puede eliminar la familia");
        }

        const familiaId = user.familia_id;

        // Limpiar miembros excepto administrador
        const { error: errorMiembros } = await this.supabase
            .from("usuarios")
            .update({ familia_id: null, parentesco: null })
            .eq("familia_id", familiaId)
            .neq("rol", "Administrador");

        if (errorMiembros) throw errorMiembros;

        // Eliminar familia
        const { error: errorFamilia } = await this.supabase
            .from("familias")
            .delete()
            .eq("id", familiaId);

        if (errorFamilia) throw errorFamilia;

        // Limpiar al admin
        await this.supabase
            .from("usuarios")
            .update({ familia_id: null, parentesco: null })
            .eq("id", user.id);

        return true;
    }
}
