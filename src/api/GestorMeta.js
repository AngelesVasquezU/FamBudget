const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(amount);
};

export class GestorMetas { 
  constructor(supabase, gestorUsuario) { // MCOD005-1
    this.supabase = supabase;
    this.gestorUsuario  = gestorUsuario;
  }

  // MCOD005-2
  async obtenerMetas(usuarioId) {
    try {
      const { data: usuario, error: errorUsuario } = await this.supabase
        .from("usuarios")
        .select("familia_id")
        .eq("id", usuarioId)
        .single();

      if (errorUsuario) throw errorUsuario;

      const familiaId = usuario?.familia_id || null;

      let query = this.supabase
        .from("metas")
        .select(`
          *,
          usuarios:usuario_id(nombre)
        `);

      if (familiaId) {
        query = query.or(
          `usuario_id.eq.${usuarioId},familia_id.eq.${familiaId}`
        );
      } else {
        query = query.eq("usuario_id", usuarioId);
      }

      const { data, error } = await query.order("fecha_creacion", {
        ascending: false,
      });

      if (error) throw error;

      return data;

    } catch (error) {
      console.error("Error en obtenerMetas:", error);
      throw error;
    }
  }

  // MCOD005-3
  async crearMeta({ nombre, monto_objetivo, fecha_limite, familia_id, usuario_id, es_familiar = false }) {
    try {
      const { data, error } = await this.supabase
        .from("metas")
        .insert([{ 
          nombre, 
          monto_objetivo, 
          fecha_limite, 
          familia_id, 
          usuario_id,
          es_familiar,
          monto_actual: 0
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error en crearMeta:', error);
      throw error;
    }
  }
  
  // MCOD005-4
  async editarMeta(id, { nombre, monto_objetivo, fecha_limite, es_familiar }) {
    try {
      const user_id = await this.gestorUsuario.obtenerIdUsuario();
      if (!user_id) throw new Error("No se pudo obtener el ID del usuario");

      const { data: usuario, error: errorUsuario } = await this.supabase
        .from('usuarios')
        .select('familia_id')
        .eq('id', user_id)
        .single();

      if (errorUsuario) throw errorUsuario;
      if (!usuario) throw new Error('Usuario no encontrado');

      const familia_id = usuario.familia_id;

      const updateData = {
        nombre,
        monto_objetivo,
        fecha_limite,
        es_familiar,
        familia_id: es_familiar ? familia_id : null,
        usuario_id: es_familiar ? null : user_id
      };

      const { data, error } = await this.supabase
        .from("metas")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      
      if (error) {
        console.error('Error en editarMeta:', error);
        throw error;
      } 
      
      console.log('Meta editada exitosamente:', data);
      return data;
    } catch (error) {
      console.error('Error en editarMeta:', error);
      throw error;
    }
  }

  // MCOD005-5
  async eliminarMeta(id) {
    const { error } = await this.supabase
      .from("metas")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return true;
  }

  // MCOD005-6
  async agregarAhorro(metaId, monto, usuarioId, movimientoId = null) {
    try {
      if (!metaId || !usuarioId || !monto || monto <= 0) {
        throw new Error("Parámetros inválidos para el aporte");
      }

      const saldoDisponible = await this.obtenerSaldoDisponible(usuarioId);

      if (monto > saldoDisponible) {
        throw new Error(
          `Ingresos insuficientes. Disponible: ${formatCurrency(saldoDisponible)}`
        );
      }

      const { data: meta, error: metaError } = await this.supabase
        .from("metas")
        .select("monto_actual, monto_objetivo, nombre")
        .eq("id", metaId)
        .single();
      if (metaError) throw new Error("Meta no encontrada");

      const nuevoMonto = parseFloat(meta.monto_actual) + parseFloat(monto);

      if (nuevoMonto > meta.monto_objetivo) {
        throw new Error(
          `El aporte excede el objetivo. Máximo permitido: ${formatCurrency(
            meta.monto_objetivo - meta.monto_actual
          )}`
        );
      }

      const { error: updateMetaError } = await this.supabase
        .from("metas")
        .update({ monto_actual: nuevoMonto })
        .eq("id", metaId);

      if (updateMetaError) throw updateMetaError;

      const nuevoSaldo = saldoDisponible - monto;

      const { error: updateSaldoError } = await this.supabase
        .from("usuarios")
        .update({ saldo_disponible: nuevoSaldo })
        .eq("id", usuarioId);

      if (updateSaldoError) throw updateSaldoError;
      console.log("➡datos aporte meta:", {
        metaId,
        monto,
        usuarioId,
        movimientoId
      });
      const { error: aporteError } = await this.supabase
        .from("aportes_meta")
        .insert([
          {
            meta_id: metaId,
            movimiento_id: movimientoId,
            monto: parseFloat(monto),
          },
        ]);

      if (aporteError) throw aporteError;

      return {
        exito: true,
        nuevoSaldo,
        nuevoMonto,
        mensaje: "Aporte registrado correctamente",
      };

    } catch (error) {
      console.error("Error en agregarAhorro:", error);
      throw error;
    }
  }

  // MCOD005-7
  async obtenerSaldoDisponible(usuarioId) {
    try {
      console.log("Buscando saldo para usuario ID:", usuarioId);
      const { data, error } = await this.supabase
        .from("usuarios")
        .select("saldo_disponible")
        .eq("id", usuarioId)
        .single();

      if (error) {
        console.error("Error en obtenerSaldoDisponible:", error);
        throw error;
      }

      const saldo = parseFloat(data?.saldo_disponible) || 0;
      console.log("Saldo encontrado:", saldo);
      return saldo;
    } catch (err) {
      console.error("Error al obtener saldo disponible:", err);
      throw new Error("No se pudo obtener el saldo disponible del usuario");
    }
  }
}