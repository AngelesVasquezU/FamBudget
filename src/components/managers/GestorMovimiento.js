export class GestorMovimiento { // COD-001
  constructor(supabase) {
    this.supabase = supabase;
  }

  // MCOD002-1 - Crear movimiento (actualizado para actualizar metas)
  async crearMovimiento({ usuarioId, conceptoId, tipo, monto, comentario, fecha, metaId, montoMeta }) {
    try {
      console.log('Creando movimiento con datos:', {
        usuarioId, conceptoId, tipo, monto, comentario, fecha, metaId, montoMeta
      });

      if (metaId && tipo !== 'ingreso') {
        throw new Error('Solo los ingresos pueden estar asociados a metas');
      }

      const movimientoData = {
        usuario_id: usuarioId,
        tipo,
        monto: parseFloat(monto),
        comentario: comentario || null,
        fecha: fecha || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };

      if (conceptoId) {
        movimientoData.concepto_id = conceptoId;
      }

      if (metaId && montoMeta) {
        movimientoData.meta_id = metaId;
        movimientoData.monto_meta = parseFloat(montoMeta);
        movimientoData.fecha_aporte_meta = new Date().toISOString();
      }

      let movimientoCreado;

      if (metaId && montoMeta) {
        const { data: meta, error: metaError } = await this.supabase
          .from("metas")
          .select("monto_actual, monto_objetivo, nombre")
          .eq("id", metaId)
          .single();

        if (metaError) {
          console.error('Error al obtener meta:', metaError);
          throw new Error('No se pudo encontrar la meta especificada');
        }

        const nuevoMonto = parseFloat(meta.monto_actual) + parseFloat(montoMeta);
        if (nuevoMonto > meta.monto_objetivo) {
          throw new Error(`El aporte excede el objetivo de la meta. Máximo permitido: ${meta.monto_objetivo - meta.monto_actual}`);
        }

        const { data: movimiento, error: movError } = await this.supabase
          .from("movimientos")
          .insert([movimientoData])
          .select()
          .single();

        if (movError) {
          console.error('Error al crear movimiento:', movError);
          throw movError;
        }

        movimientoCreado = movimiento;

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
            .delete()
            .eq("id", movimiento.id);
          throw new Error('Error al actualizar la meta con el aporte');
        }

        console.log('Movimiento creado y meta actualizada exitosamente');
        
      } else {
        const { data: movimiento, error: movError } = await this.supabase
          .from("movimientos")
          .insert([movimientoData])
          .select()
          .single();

        if (movError) {
          console.error('Error al crear movimiento:', movError);
          throw movError;
        }

        movimientoCreado = movimiento;
        console.log('Movimiento creado exitosamente');
      }

      return movimientoCreado;

    } catch (err) {
      console.error("GestorMovimiento error:", err);
      throw err;
    }
  }

  // MCOD002-9 - Método específico para crear aportes a metas
  async crearAporteMeta({ usuarioId, metaId, monto, comentario, fecha }) {
    try {
      console.log('Creando aporte a meta:', { usuarioId, metaId, monto });

      if (!metaId) throw new Error('Se requiere el ID de la meta');
      if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a 0');

      const { data: meta, error: metaError } = await this.supabase
        .from("metas")
        .select("monto_actual, monto_objetivo, nombre, usuario_id, familia_id")
        .eq("id", metaId)
        .single();

      if (metaError) throw new Error('Meta no encontrada');

      const nuevoMonto = parseFloat(meta.monto_actual) + parseFloat(monto);
      
      if (nuevoMonto > meta.monto_objetivo) {
        throw new Error(`El aporte excede el objetivo de la meta "${meta.nombre}". Máximo permitido: ${meta.monto_objetivo - meta.monto_actual}`);
      }

      const movimientoData = {
        usuario_id: usuarioId,
        tipo: 'egreso',
        monto: parseFloat(monto),
        comentario: comentario || `Aporte a meta: ${meta.nombre}`,
        fecha: fecha || new Date().toISOString().split('T')[0],
        meta_id: metaId,
        monto_meta: parseFloat(monto),
        fecha_aporte_meta: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const { data: movimiento, error: movError } = await this.supabase
        .from("movimientos")
        .insert([movimientoData])
        .select()
        .single();

      if (movError) throw movError;

      const { error: updateError } = await this.supabase
        .from("metas")
        .update({ 
          monto_actual: nuevoMonto
        })
        .eq("id", metaId);

      if (updateError) {
        await this.supabase
          .from("movimientos")
          .delete()
          .eq("id", movimiento.id);
        throw new Error('Error al actualizar la meta');
      }

      console.log('Aporte a meta realizado exitosamente');
      return movimiento;

    } catch (error) {
      console.error('Error en crearAporteMeta:', error);
      throw error;
    }
  }
  
  // MCOD002-2 - Obtener total por tipo
  async obtenerTotalPorTipo(usuarioId, tipo, fecha = null) {
    try {
      let query = this.supabase
        .from("movimientos")
        .select("monto")
        .eq("usuario_id", usuarioId)
        .eq("tipo", tipo);

      if (fecha) {
        query = query.eq("fecha", fecha);
      }

      const { data, error } = await query;

      if (error) throw error;

      const total = data.reduce((acc, mov) => acc + parseFloat(mov.monto), 0);
      console.log(`Total ${tipo} para usuario ${usuarioId}:`, total);
      
      return total;
    } catch (error) {
      console.error('Error en obtenerTotalPorTipo:', error);
      throw error;
    }
  }

  // MCOD002-3 - Obtener movimientos por usuario
  async obtenerMovimientosPorUsuario(usuarioId, limite = 50) {
    try {
      const { data, error } = await this.supabase
        .from("movimientos")
        .select(`
          *,
          conceptos:concepto_id(nombre, tipo),
          metas:meta_id(nombre)
        `)
        .eq("usuario_id", usuarioId)
        .order("created_at", { ascending: false })
        .limit(limite);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error en obtenerMovimientosPorUsuario:', error);
      throw error;
    }
  }

  // MCOD002-4 - Obtener movimientos por fecha
  async obtenerMovimientosPorFecha(usuarioId, fecha) {
    try {
      const { data, error } = await this.supabase
        .from("movimientos")
        .select(`
          *,
          conceptos:concepto_id(nombre, tipo),
          metas:meta_id(nombre)
        `)
        .eq("usuario_id", usuarioId)
        .eq("fecha", fecha)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error en obtenerMovimientosPorFecha:', error);
      throw error;
    }
  }

  // MCOD002-5 - Obtener movimientos por meta
  async obtenerMovimientosPorMeta(metaId) {
    try {
      const { data, error } = await this.supabase
        .from("movimientos")
        .select(`
          *,
          usuarios:usuario_id(nombre),
          conceptos:concepto_id(nombre)
        `)
        .eq("meta_id", metaId)
        .order("fecha_aporte_meta", { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error en obtenerMovimientosPorMeta:', error);
      throw error;
    }
  }

  // MCOD002-6 - Eliminar movimiento
  async eliminarMovimiento(movimientoId) {
    try {
      const { data: movimiento, error: getError } = await this.supabase
        .from("movimientos")
        .select("meta_id, monto_meta")
        .eq("id", movimientoId)
        .single();

      if (getError) throw getError;

      let resultado;

      if (movimiento.meta_id && movimiento.monto_meta) {
        const { data: meta, error: metaError } = await this.supabase
          .from("metas")
          .select("monto_actual")
          .eq("id", movimiento.meta_id)
          .single();

        if (metaError) throw metaError;

        const nuevoMonto = parseFloat(meta.monto_actual) - parseFloat(movimiento.monto_meta);

        const { error: updateError } = await this.supabase
          .from("metas")
          .update({ 
            monto_actual: Math.max(0, nuevoMonto) 
          })
          .eq("id", movimiento.meta_id);

        if (updateError) throw updateError;

        const { error: deleteError } = await this.supabase
          .from("movimientos")
          .delete()
          .eq("id", movimientoId);

        if (deleteError) throw deleteError;

        resultado = { movimientoEliminado: true, metaActualizada: true };

      } else {
        const { error: deleteError } = await this.supabase
          .from("movimientos")
          .delete()
          .eq("id", movimientoId);

        if (deleteError) throw deleteError;

        resultado = { movimientoEliminado: true, metaActualizada: false };
      }

      console.log('Movimiento eliminado exitosamente:', movimientoId);
      return resultado;

    } catch (error) {
      console.error('Error en eliminarMovimiento:', error);
      throw error;
    }
  }

  async obtenerBalanceDelDia(usuarioId, fecha = null) {
    try {
      const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
      
      const ingresos = await this.obtenerTotalPorTipo(usuarioId, 'ingreso', fechaConsulta);
      const egresos = await this.obtenerTotalPorTipo(usuarioId, 'egreso', fechaConsulta);
      
      const balance = ingresos - egresos;
      
      console.log(`Balance del día ${fechaConsulta}:`, { ingresos, egresos, balance });
      
      return {
        ingresos,
        egresos,
        balance,
        fecha: fechaConsulta
      };
    } catch (error) {
      console.error('Error en obtenerBalanceDelDia:', error);
      throw error;
    }
  }

  async obtenerMovimientosPorRango(usuarioId, fechaInicio, fechaFin) {
    try {
      const { data, error } = await this.supabase
        .from("movimientos")
        .select(`
          *,
          conceptos:concepto_id(nombre, tipo),
          metas:meta_id(nombre)
        `)
        .eq("usuario_id", usuarioId)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error en obtenerMovimientosPorRango:', error);
      throw error;
    }
  }

  async obtenerMovimientosRecientes(usuarioId, pagina = 1, porPagina = 10) {
    try {
      const inicio = (pagina - 1) * porPagina;
      
      const { data, error, count } = await this.supabase
        .from("movimientos")
        .select(`
          *,
          conceptos:concepto_id(nombre, tipo),
          metas:meta_id(nombre)
        `, { count: 'exact' })
        .eq("usuario_id", usuarioId)
        .order("created_at", { ascending: false })
        .range(inicio, inicio + porPagina - 1);

      if (error) throw error;

      return {
        movimientos: data || [],
        total: count || 0,
        pagina,
        totalPaginas: Math.ceil((count || 0) / porPagina)
      };
    } catch (error) {
      console.error('Error en obtenerMovimientosRecientes:', error);
      throw error;
    }
  }

  async verificarEstadoMeta(metaId) {
    try {
      const { data: meta, error } = await this.supabase
        .from("metas")
        .select("id, nombre, monto_actual, monto_objetivo, fecha_creacion")
        .eq("id", metaId)
        .single();
      
      if (error) throw error;
      
      console.log('Estado actual de la meta:', meta);
      return meta;
    } catch (error) {
      console.error('Error al verificar meta:', error);
      throw error;
    }
  }

  async obtenerResumenPorConcepto(usuarioId, fechaInicio, fechaFin) {
    try {
      const { data, error } = await this.supabase
        .from("movimientos")
        .select(`
          monto,
          tipo,
          conceptos:concepto_id(nombre, tipo)
        `)
        .eq("usuario_id", usuarioId)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin);

      if (error) throw error;

      const resumen = {};
      data.forEach(mov => {
        const conceptoNombre = mov.conceptos?.nombre || 'Sin concepto';
        if (!resumen[conceptoNombre]) {
          resumen[conceptoNombre] = {
            ingresos: 0,
            egresos: 0,
            tipo: mov.conceptos?.tipo || 'egreso'
          };
        }

        if (mov.tipo === 'ingreso') {
          resumen[conceptoNombre].ingresos += parseFloat(mov.monto);
        } else {
          resumen[conceptoNombre].egresos += parseFloat(mov.monto);
        }
      });

      return resumen;
    } catch (error) {
      console.error('Error en obtenerResumenPorConcepto:', error);
      throw error;
    }
  }
}