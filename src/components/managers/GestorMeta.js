const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(amount);
};

export class GestorMetas { 
  constructor(supabase) { 
    this.supabase = supabase;
  }

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

  async obtenerMetaPorId(id) {
    try {
      const { data, error } = await this.supabase
        .from("metas")
        .select(`
          *,
          usuarios:usuario_id(nombre)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error en obtenerMetaPorId:', error);
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
      
      const { data, error } = await this.supabase
        .from("metas")
        .update({ 
          nombre, 
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
      console.log('Eliminando meta ID:', id);
      
      const { data: meta, error: errorMeta } = await this.supabase
        .from("metas")
        .select("id, nombre, usuario_id")
        .eq("id", id)
        .single();

      console.log('Meta a eliminar:', meta);
      
      if (errorMeta) {
        console.error('Error al obtener meta:', errorMeta);
        throw new Error('La meta no existe o no se pudo encontrar');
      }

      const { data: movimientos, error: errorMov } = await this.supabase
        .from("movimientos")
        .select("id, monto")
        .eq("meta_id", id);

      console.log('Movimientos relacionados:', movimientos);
      
      if (errorMov) {
        console.error('Error al verificar movimientos:', errorMov);
      }

      // Intentar eliminar la meta
      console.log('Ejecutando DELETE...');
      const { error, count } = await this.supabase
        .from("metas")
        .delete()
        .eq("id", id);

      console.log('Resultado DELETE:', { error, count });

      if (error) {
        console.error('Error en eliminarMeta:', error);
        console.error('Código:', error.code);
        console.error('Mensaje:', error.message);
        console.error('Detalles:', error.details);
        throw error;
      }

      console.log('Meta eliminada exitosamente');
      return true;
    } catch (error) {
      console.error('Error en eliminarMeta:', error);
      throw error;
    }
  }

  async agregarAhorro(metaId, monto, usuarioId, comentario = "Aporte a meta") {
    try {
      console.log('agregarAhorro - Parámetros:', { metaId, monto, usuarioId });

      if (!metaId || !usuarioId || !monto || monto <= 0) {
        throw new Error('Parámetros inválidos para el aporte');
      }

      const { data: usuario, error: usuarioError } = await this.supabase
        .from("usuarios")
        .select("familia_id")
        .eq("id", usuarioId)
        .single();

      if (usuarioError) throw usuarioError;

      const saldoDisponibleAntes = await this.obtenerSaldoDisponible(usuario.familia_id, usuarioId);
      console.log('Saldo disponible ANTES de asignar:', saldoDisponibleAntes);

      if (monto > saldoDisponibleAntes) {
        throw new Error(`Ingresos disponibles insuficientes. Disponible: ${formatCurrency(saldoDisponibleAntes)}, Intenta asignar: ${formatCurrency(monto)}`);
      }

      const { data: meta, error: metaError } = await this.supabase
        .from("metas")
        .select("monto_actual, monto_objetivo, nombre")
        .eq("id", metaId)
        .single();

      if (metaError) throw new Error('No se pudo encontrar la meta especificada');

      const nuevoMonto = parseFloat(meta.monto_actual) + parseFloat(monto);
      if (nuevoMonto > meta.monto_objetivo) {
        throw new Error(`El aporte excede el objetivo de la meta. Máximo permitido: ${formatCurrency(meta.monto_objetivo - meta.monto_actual)}`);
      }

      const { data: ingresosNoAsignados, error: ingresosError } = await this.supabase
        .from("movimientos")
        .select("id, monto, fecha, concepto_id, comentario")
        .eq("usuario_id", usuarioId)
        .eq("tipo", "ingreso")
        .is("meta_id", null)
        .order("fecha", { ascending: false })
        .limit(10);

      if (ingresosError) throw ingresosError;

      if (!ingresosNoAsignados || ingresosNoAsignados.length === 0) {
        throw new Error('No hay ingresos disponibles para asignar a la meta');
      }

      let ingresoSeleccionado = ingresosNoAsignados.find(ingreso => parseFloat(ingreso.monto) >= monto);
      
      if (!ingresoSeleccionado) {
        ingresoSeleccionado = ingresosNoAsignados.reduce((prev, current) => 
          (parseFloat(prev.monto) > parseFloat(current.monto)) ? prev : current
        );
        console.log('Usando el ingreso de mayor monto disponible:', ingresoSeleccionado.monto);
      }

      console.log('Ingreso seleccionado para asignar:', ingresoSeleccionado);

      const comentarioActualizado = ingresoSeleccionado.comentario 
        ? `${ingresoSeleccionado.comentario} | Asignado a meta: ${meta.nombre}`
        : `Asignado a meta: ${meta.nombre}`;

      const { error: updateMovError } = await this.supabase
        .from("movimientos")
        .update({
          meta_id: metaId,
          monto_meta: parseFloat(monto),
          fecha_aporte_meta: new Date().toISOString(),
          comentario: comentarioActualizado
        })
        .eq("id", ingresoSeleccionado.id);

      if (updateMovError) {
        console.error('Error al actualizar movimiento:', updateMovError);
        throw updateMovError;
      }

      const { error: updateError } = await this.supabase
        .from("metas")
        .update({ 
          monto_actual: nuevoMonto
        })
        .eq("id", metaId);

      if (updateError) {
        console.error('Error al actualizar meta:', updateError);
        await this.supabase
          .from("movimientos")
          .update({
            meta_id: null,
            monto_meta: null,
            fecha_aporte_meta: null,
            comentario: ingresoSeleccionado.comentario
          })
          .eq("id", ingresoSeleccionado.id);
        throw new Error('Error al actualizar la meta');
      }

      const saldoDisponibleDespues = await this.obtenerSaldoDisponible(usuario.familia_id, usuarioId);
      console.log('Saldo disponible DESPUÉS de asignar:', saldoDisponibleDespues);

      console.log('Aporte realizado exitosamente asignando ingreso a meta');
      return { 
        movimiento: ingresoSeleccionado, 
        metaActualizada: true,
        montoAsignado: monto,
        saldoDisponibleAntes,
        saldoDisponibleDespues
      };

    } catch (error) {
      console.error('Error en agregarAhorro:', error);
      throw error;
    }
  }
  async obtenerSaldoDisponible(familiaId, usuarioId = null) {
  try {
    if (!familiaId && !usuarioId) {
      return 0;
    }

    let query = this.supabase
      .from("movimientos")
      .select("monto, tipo, meta_id, usuario_id");

    if (familiaId) {
      const { data: usuariosFamilia, error: errorUsuarios } = await this.supabase
        .from("usuarios")
        .select("id")
        .eq("familia_id", familiaId);

      if (errorUsuarios) throw errorUsuarios;

      const usuarioIds = usuariosFamilia.map(u => u.id);
      query = query.in("usuario_id", usuarioIds);
    } else if (usuarioId) {
      query = query.eq("usuario_id", usuarioId);
    }

    const { data: movimientos, error } = await query;

    if (error) throw error;

    let totalIngresos = 0;
    let totalIngresosAsignados = 0;

    movimientos.forEach(mov => {
      const monto = parseFloat(mov.monto);
      
      if (mov.tipo === 'ingreso') {
        totalIngresos += monto;
        if (mov.meta_id) {
          totalIngresosAsignados += monto;
        }
      }
    });

    const saldoDisponible = totalIngresos - totalIngresosAsignados;

    console.log('Cálculo CORREGIDO de saldo:', {
      totalIngresos,
      totalIngresosAsignados,
      saldoDisponible
    });

    return Math.max(0, saldoDisponible);
  } catch (error) {
    console.error('Error en obtenerSaldoDisponible:', error);
    return 0;
  }
}

  async obtenerIngresosNoAsignados(usuarioId, familiaId = null) {
    try {
      let query = this.supabase
        .from("movimientos")
        .select(`
          *,
          conceptos:concepto_id(nombre)
        `)
        .eq("tipo", "ingreso")
        .is("meta_id", null)
        .order("fecha", { ascending: false });

      if (familiaId) {
        const { data: usuariosFamilia, error: errorUsuarios } = await this.supabase
          .from("usuarios")
          .select("id")
          .eq("familia_id", familiaId);

        if (errorUsuarios) throw errorUsuarios;

        const usuarioIds = usuariosFamilia.map(u => u.id);
        query = query.in("usuario_id", usuarioIds);
      } else if (usuarioId) {
        query = query.eq("usuario_id", usuarioId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error en obtenerIngresosNoAsignados:', error);
      throw error;
    }
  }

  async desasignarIngresoDeMeta(movimientoId) {
    try {
      console.log('Desasignando ingreso de meta:', movimientoId);

      const { data: movimiento, error: movError } = await this.supabase
        .from("movimientos")
        .select("meta_id, monto_meta")
        .eq("id", movimientoId)
        .single();

      if (movError) throw movError;

      if (!movimiento.meta_id) {
        throw new Error('Este movimiento no está asignado a ninguna meta');
      }

      const { data: meta, error: metaError } = await this.supabase
        .from("metas")
        .select("monto_actual")
        .eq("id", movimiento.meta_id)
        .single();

      if (metaError) throw metaError;

      const nuevoMonto = Math.max(0, parseFloat(meta.monto_actual) - parseFloat(movimiento.monto_meta));

      const { error: updateMovError } = await this.supabase
        .from("movimientos")
        .update({
          meta_id: null,
          monto_meta: null,
          fecha_aporte_meta: null,
          comentario: null
        })
        .eq("id", movimientoId);

      if (updateMovError) throw updateMovError;

      const { error: updateMetaError } = await this.supabase
        .from("metas")
        .update({ 
          monto_actual: nuevoMonto
        })
        .eq("id", movimiento.meta_id);

      if (updateMetaError) {
        await this.supabase
          .from("movimientos")
          .update({
            meta_id: movimiento.meta_id,
            monto_meta: movimiento.monto_meta,
            fecha_aporte_meta: new Date().toISOString()
          })
          .eq("id", movimientoId);
        throw new Error('Error al actualizar la meta');
      }

      console.log('Ingreso desasignado exitosamente de la meta');
      return { 
        movimientoId, 
        metaId: movimiento.meta_id,
        montoDesasignado: movimiento.monto_meta
      };

    } catch (error) {
      console.error('Error en desasignarIngresoDeMeta:', error);
      throw error;
    }
  }
}