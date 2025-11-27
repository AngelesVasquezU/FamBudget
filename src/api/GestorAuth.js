// GES-006
/**
 * GestorAuth - Gestor de Autenticación
 *
 * Clase responsable de manejar las operaciones de autenticación utilizando Supabase.
 * Proporciona métodos para login, registro, logout y obtención del usuario actual.
 * 
 * Nota:
 * - La creación del registro asociado en la tabla "usuarios" es gestionada
 *   automáticamente por un TRIGGER en auth.users.
 */
export class GestorAuth {

    // MGES001-1
    /**
     * Constructor de GestorAuth.
     * @param {Object} supabase - Instancia del cliente de Supabase.
     */
    constructor(supabase) {
        this.supabase = supabase;
    }

    // MGES001-2
    /**
     * Autentica a un usuario en el sistema.
     * @async
     * @param {string} email - Correo del usuario.
     * @param {string} password - Contraseña del usuario.
     * @returns {Promise<Object>} Usuario autenticado.
     * @throws {Error} Si las credenciales son inválidas.
     */
    async login(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw new Error(error.message || error.error_description);
        if (!data.user) throw new Error("No se pudo iniciar sesión.");

        return data.user;
    }

    // MGES001-3 
    /**
     * Registra un nuevo usuario en Supabase Authentication.
     *
     * Los metadatos enviados son utilizados por un TRIGGER para crear
     * el registro correspondiente en la tabla "usuarios".
     *
     * @async
     * @param {Object} params - Datos del nuevo usuario.
     * @param {string} params.email - Correo del usuario.
     * @param {string} params.password - Contraseña del usuario.
     * @param {string} params.fullName - Nombre completo.
     * @param {string|null} params.parentesco - Parentesco (opcional).
     * @param {string} params.role - Rol del usuario.
     * @returns {Promise<Object>} Datos generados por Supabase.
     * @throws {Error} Si ocurre un error en el registro.
     */
    async register({ email, password, fullName, parentesco, role }) {
        const { data: authData, error: authError } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    fullName: fullName,
                    role: role,
                    parentesco: parentesco || null
                }
            }
        });

        if (authError) {
            throw new Error(authError.message || authError.error_description);
        }

        return authData;
    }

    // MGES001-4
    /**
     * Cierra la sesión del usuario actual.
     * @async
     * @returns {Promise<void>}
     * @throws {Error} Si falla el cierre de sesión.
     */
    async logout() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw new Error(error.message || error.error_description);
    }

    // MGES001-5
    /**
     * Obtiene el usuario actualmente autenticado.
     * @returns {Promise<Object>} Usuario actual o null si no hay sesión.
     */
    getUser() {
        return this.supabase.auth.getUser();
    }
}
