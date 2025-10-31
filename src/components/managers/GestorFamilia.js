export class GestorFamilia { 
    constructor(supabase, gestorUsuario) { 
        this.supabase = supabase;
        this.gestorUsuario = gestorUsuario;
    }

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

    async obtenerMiembros(familia_id) {
        const { data, error } = await this.supabase
        .from('usuarios')
        .select('id, nombre, correo, rol, parentesco')
        .eq('familia_id', familia_id);

        if (error) throw error;
        return data;
    }

    async crearFamilia(nombre) {
    const { data, error } = await this.supabase
        .from('familias')
        .insert([{ nombre }])
        .select()
        .single();
    if (error) throw error;
    return data;
    }

    async agregarMiembro(familia_id, correo, parentesco) {
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
        .update({ familia_id, parentesco })
        .eq('id', usuario.id);

    if (error) throw error;

    return true;
    }

    async actualizarParentesco(usuario_id, nuevoParentesco) {
        const { error } = await this.supabase
            .from('usuarios')
            .update({ parentesco: nuevoParentesco })
            .eq('id', usuario_id);

        if (error) throw error;
        return true;
    }

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
    
    async cambiarRolAdmin(familia_id, nuevoAdminId, adminActualId) {
        const { data: miembro, error: errorMiembro } = await this.supabase
            .from("usuarios")
            .select("familia_id, rol")
            .eq("id", nuevoAdminId)
            .single();

        if (errorMiembro || !miembro) throw new Error("Miembro no encontrado");
        if (miembro.familia_id !== familia_id)
            throw new Error("El usuario no pertenece a esta familia");
        console.log("ids: ", adminActualId, ", ", nuevoAdminId);
        const { error: err1 } = await this.supabase
            .from("usuarios")
            .update({ rol: "Administrador" })
            .eq("id", nuevoAdminId);

        const { error: err2 } = await this.supabase
            .from("usuarios")
            .update({ rol: "Miembro familiar" })
            .eq("id", adminActualId);

        if (err1 || err2) throw new Error("Error al cambiar el rol");

        return true;
    }

}
