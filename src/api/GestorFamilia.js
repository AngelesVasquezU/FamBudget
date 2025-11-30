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
        if (!user) throw new Error("No hay usuario autenticado");

        const { data, error } = await this.supabase.rpc("obtener_mi_familia", {
            p_usuario_id: user.id
        });

        if (error) throw error;

        if (data?.error) {
            console.warn("obtener_mi_familia:", data.error);
            return null;
        }

        return data.familia;
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
        const { data, error } = await this.supabase.rpc(
            "obtener_miembros_familia",
            { p_familia_id: familia_id }
        );

        if (error) throw error;

        if (data?.error) {
            console.warn("obtener_miembros_familia:", data.error);
            return [];
        }

        return data.miembros || [];
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

        const { data, error } = await this.supabase.rpc("crear_familia", {
            p_nombre: nombre,
            p_usuario_id: user.id
        });

        if (error) throw error;

        if (data?.error) {
            throw new Error(data.error);
        }

        return data.familia;
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
        const { data, error } = await this.supabase.rpc(
            "agregar_miembro_familia",
            {
                p_familia_id: familia_id,
                p_correo: correo
            }
        );

        if (error) throw error;

        if (data?.error) {
            // El error de negocio viene desde la función SQL
            throw new Error(data.error);
        }

        // data.miembro contiene el usuario actualizado
        return data;
    }

    // ============================================================
    // MGES002-5 — Eliminar Miembro
    // ============================================================

    /**
     * Elimina a un usuario de una familia.
     * No permite que la administradora se elimine a sí misma.
     *
     * @param {string} usuarioId - ID del usuario a eliminar.
     * @returns {Promise<boolean>}
     */
    async eliminarMiembro(usuarioId) {
        const adminId = await this.gestorUsuario.obtenerIdUsuario();
        if (!adminId) throw new Error("No se pudo identificar al usuario actual");

        const { data, error } = await this.supabase.rpc("eliminar_miembro_familia", {
            p_usuario_id: usuarioId,
            p_admin_id: adminId
        });

        if (error) throw error;

        if (data?.error) {
            throw new Error(data.error);
        }

        return data;
    }


    // ============================================================
    // MGES002-6 — Transferir Rol de Administrador
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
    async cambiarRolAdmin(familia_id, nuevoAdminId) {
        const adminActualId = await this.gestorUsuario.obtenerIdUsuario();
        if (!adminActualId) throw new Error("No se pudo identificar al usuario actual");

        const { data, error } = await this.supabase.rpc("cambiar_admin_familia", {
            p_familia_id: familia_id,
            p_nuevo_admin_id: nuevoAdminId,
            p_admin_actual_id: adminActualId
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        return data;
    }

    // ============================================================
    // MGES002-7 — Eliminar Familia
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
        const adminId = await this.gestorUsuario.obtenerIdUsuario();
        if (!adminId) throw new Error("No se pudo identificar al usuario");

        const { data, error } = await this.supabase.rpc("eliminar_familia_completa", {
            p_admin_id: adminId
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        return true;
    }

}
