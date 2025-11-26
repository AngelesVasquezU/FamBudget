export class GestorAuth {
    constructor(supabase) {
        this.supabase = supabase;
    }

    // Login con email y password
    async login(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error("Login error:", error.message);
            throw error;
        }

        if (!data.user) {
            throw new Error("No se pudo iniciar sesión. ¿El correo está confirmado?");
        }

        return data.user;
    }

    // Logout
    async logout() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    // Obtener usuario actual
    getUser() {
        return this.supabase.auth.getUser();
    }
}
