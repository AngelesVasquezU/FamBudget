export class GestorFamilia { // GES-002
    constructor(supabase, gestorUsuario) {
        this.supabase = supabase;
        this.gestorUsuario = gestorUsuario;
    }

    //MGES002-1
    // Obtiene los datos de la familia del usuario autenticado.
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

    //MGES002-2
    // Obtiene la lista de miembros de una familia.
    async obtenerMiembros(familia_id) {
        const { data, error } = await this.supabase
            .from('usuarios')
            .select('id, nombre, correo, rol, parentesco')
            .eq('familia_id', familia_id);

        if (error) throw error;
        return data;
    }

    //MGES002-3
    // Crea una nueva familia y asigna al usuario actual a ella.
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

    //MGES002-4
    // Agrega un miembro existente (por correo) a una familia.
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

    //MGES002-5
    // Actualiza el parentesco de un miembro dentro de la familia.
    async actualizarParentesco(usuario_id, nuevoParentesco) {
        const { error } = await this.supabase
            .from('usuarios')
            .update({ parentesco: nuevoParentesco })
            .eq('id', usuario_id);

        if (error) throw error;
        return true;
    }

    //MGES002-6
    // Elimina un miembro de la familia (excepto a la administradora).
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

    //MGES002-7
    // Cambia el rol de administrador a otro miembro de la misma familia.
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

    //MGES002-8
    // Elimina la familia completa (solo el admin puede hacerlo).
    async eliminarFamilia() {
        const user = await this.gestorUsuario.obtenerUsuario();
        if (!user) throw new Error("No hay usuario autenticado");
        if (!user.familia_id) throw new Error("No perteneces a ninguna familia");

        if (user.rol !== "Administrador") {
            throw new Error("Solo el administrador puede eliminar la familia");
        }

        const familiaId = user.familia_id;

        const { error: errorMiembros } = await this.supabase
            .from("usuarios")
            .update({ familia_id: null, parentesco: null })
            .eq("familia_id", familiaId)
            .neq("rol", "Administrador");

        if (errorMiembros) throw errorMiembros;

        const { error: errorFamilia } = await this.supabase
            .from("familias")
            .delete()
            .eq("id", familiaId);

        await this.supabase
            .from("usuarios")
            .update({ familia_id: null, parentesco: null })
            .eq("id", user.id);

        if (errorFamilia) throw errorFamilia;

        return true;
    }

}
