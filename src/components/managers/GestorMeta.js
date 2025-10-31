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
  async obtenerMetas(usuarioId, familiaId = null) {
    try {
      let query = this.supabase 
        .from("metas")
        .select(`
          *,
          usuarios:usuario_id(nombre)
        `);

      if (familiaId) {
        query = query.or(`usuario_id.eq.${usuarioId},familia_id.eq.${familiaId}`);
      } else {
        query = query.eq('usuario_id', usuarioId);
      }

      const { data, error } = await query.order('fecha_creacion', { ascending: false });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error en obtenerMetas:', error);
      throw error;
    }
  }

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

  async editarMeta(id, { nombre, monto_objetivo, fecha_limite, es_familiar }) {
    try {
      console.log('📝 Editando meta ID:', id, 'con datos:', { nombre, monto_objetivo, fecha_limite, es_familiar });
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
      console.log("familia id: ", familia_id);
      const { data, error } = await this.supabase
        .from("metas")
        .update({ 
          nombre, 
          familia_id,
          monto_objetivo, 
          fecha_limite, 
          es_familiar 
        })
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

  async eliminarMeta(id) {
    try {

      const { error, count } = await this.supabase
        .from("metas")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return true;
    } catch (error) {
      throw error;
    }
  }

  async agregarAhorro(metaId, monto, usuarioId) {
    try {
      if (!metaId || !usuarioId || !monto || monto <= 0) {
        throw new Error('Parámetros inválidos para el aporte');
      }

      // Obtener saldo del usuario - CORREGIR ESTA PARTE
      const { data: saldoUsuario, error: errorSaldo } = await this.supabase
        .from("usuarios")
        .select("saldo_disponible")
        .eq("id", usuarioId)
        .single();
        
      if (errorSaldo) throw new Error('No se pudo obtener el saldo del usuario: ' + errorSaldo.message);
      
      // CORRECCIÓN: saldoUsuario es un objeto, no un array
      const saldoDisponible = parseFloat(saldoUsuario.saldo_disponible) || 0;
      console.log('Saldo disponible ANTES de asignar:', saldoDisponible);

      if (monto > saldoDisponible) {
        throw new Error(`Ingresos disponibles insuficientes. Disponible: ${formatCurrency(saldoDisponible)}, Intenta asignar: ${formatCurrency(monto)}`);
      }

      const { data: meta, error: metaError } = await this.supabase
        .from("metas")
        .select("monto_actual, monto_objetivo, nombre")
        .eq("id", metaId)
        .single();

      if (metaError) throw new Error('No se pudo encontrar la meta especificada: ' + metaError.message);

      const nuevoMonto = parseFloat(meta.monto_actual) + parseFloat(monto);
      if (nuevoMonto > meta.monto_objetivo) {
        throw new Error(`El aporte excede el objetivo de la meta. Máximo permitido: ${formatCurrency(meta.monto_objetivo - meta.monto_actual)}`);
      }

      let nuevoSaldo = saldoDisponible - monto;
      console.log("saldo disponible", saldoDisponible, monto);
      
      // Actualizar saldo del usuario
      const { error: updateMovError } = await this.supabase
        .from("usuarios")
        .update({
          saldo_disponible: nuevoSaldo
        })
        .eq("id", usuarioId);

      if (updateMovError) {
        console.error('Error al actualizar saldo:', updateMovError);
        throw updateMovError;
      }

      // Actualizar monto actual de la meta
      const { error: updateError } = await this.supabase
        .from("metas")
        .update({ 
          monto_actual: nuevoMonto
        })
        .eq("id", metaId);

      if (updateError) {
        console.error('Error al actualizar meta:', updateError);
        throw updateError;
      }

      return {
        metaActualizada: true,
        montoAsignado: monto,
        saldoDisponible: nuevoSaldo
      };

    } catch (error) {
      console.error('Error en agregar ahorro:', error);
      throw error;
    }
  }

  async obtenerSaldoDisponible(usuarioId) {
    try {
      console.log("🔍 Buscando saldo para usuario ID:", usuarioId);
      const { data, error } = await this.supabase
        .from("usuarios")
        .select("saldo_disponible")
        .eq("id", usuarioId)
        .single();

      if (error) {
        console.error("❌ Error en obtenerSaldoDisponible:", error);
        throw error;
      }

      const saldo = parseFloat(data?.saldo_disponible) || 0;
      console.log("✅ Saldo encontrado:", saldo);
      return saldo;
    } catch (err) {
      console.error("❌ Error al obtener saldo disponible:", err);
      throw new Error("No se pudo obtener el saldo disponible del usuario");
    }
  }
}