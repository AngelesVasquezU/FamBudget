export class GestorMovimiento { // GES-004
  constructor(supabase, gestorMetas, gestorUsuario) {
    this.supabase = supabase;
    this.gestorMetas = gestorMetas;
    this.gestorUsuario = gestorUsuario;
  }


  // MGES004-1
  // Crea un movimiento (ingreso/egreso), actualiza el saldo y,
  // si está asociado a una meta, delega el manejo del ahorro al GestorMetas.
  async crearMovimiento({ usuarioId, conceptoId, tipo, monto, comentario, fecha, metaId, montoMeta }) {
    try {
      const { data: usuarioData, error: errorSaldo } = await this.supabase
        .from("usuarios")
        .select("saldo_disponible")
        .eq("id", usuarioId)
        .single();

      if (errorSaldo) {
        console.error("Error al obtener saldo:", errorSaldo);
        throw new Error('No se pudo obtener el saldo del usuario: ' + errorSaldo.message);
      }

      if (!usuarioData) {
        console.error("No se encontró el usuario con ID:", usuarioId);
        throw new Error('Usuario no encontrado en la base de datos');
      }

      const saldoActual = parseFloat(usuarioData.saldo_disponible) || 0;

      const { data: movimiento, error: movError } = await this.supabase
        .from("movimientos")
        .insert([
          {
            usuario_id: usuarioId,
            concepto_id: conceptoId || null,
            tipo,
            monto: parseFloat(monto),
            comentario: comentario || null,
            fecha
          }
        ])
        .select()
        .single();

      if (movError) {
        console.error("Error al crear movimiento:", movError);
        throw movError;
      }

      if (tipo === "ingreso" && metaId && montoMeta) {
        await this.gestorMetas.agregarAhorro(
          metaId,
          montoMeta,
          usuarioId,
          movimiento.id
        );

        return movimiento;
      }

      const nuevoSaldo = tipo === "ingreso"
        ? saldoActual + parseFloat(monto)
        : saldoActual - parseFloat(monto);

      const { error: updateError } = await this.supabase
        .from("usuarios")
        .update({
          saldo_disponible: nuevoSaldo
        })
        .eq("id", usuarioId);

      if (updateError) {
        console.error("Error al actualizar saldo:", updateError);
        throw updateError;
      }

      return movimiento;

    } catch (err) {
      console.error("ERROR en crearMovimiento:", err);
      console.error("Detalles del error:", {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint
      });
      throw err;
    }
  }

  // MGES004-2
  // Calcula el total de ingresos o egresos del usuario, opcionalmente filtrado por fecha exacta.
  async obtenerTotalPorTipo(usuarioId, tipo, fecha = null) {
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

    return data.reduce((acc, mov) => acc + parseFloat(mov.monto), 0);
  }

  // MGES004-3
  // Obtiene los movimientos del usuario, permite filtrar por mes/año y orden.
  async obtenerMovimientosUsuario(usuarioId, opciones = {}) {
    try {
      const {
        limit = 50,
        ordenar = "desc",
        mes = null,
        año = null
      } = opciones;

      let query = this.supabase
        .from("movimientos")
        .select(`
          id,
          usuario_id,
          concepto_id,
          tipo,
          monto,
          comentario,
          fecha,
          conceptos ( id, nombre )
        `)
        .eq("usuario_id", usuarioId)
        .order("fecha", { ascending: ordenar === "asc" })
        .limit(limit);

      if (mes && año) {
        const inicio = `${año}-${String(mes).padStart(2, "0")}-01`;
        const fin = `${año}-${String(mes).padStart(2, "0")}-31`;

        query = query.gte("fecha", inicio).lte("fecha", fin);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error al obtener movimientos:", error);
        throw error;
      }

      return data;

    } catch (err) {
      console.error("ERROR en obtenerMovimientosUsuario:", err);
      throw err;
    }
  }

  // MGES004-4
  // Obtiene movimientos entre fechas, puede ser personal o familiar,
  // y calcula totales de ingresos, egresos y balance.
  async obtenerBalanceEntreFechas({ fechaInicio, fechaFin, tipo, usuarioId }) {
    try {
      let query = this.supabase
        .from("movimientos")
        .select("*")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin);

      if (tipo === "personal") {
        query = query.eq("usuario_id", usuarioId);
      }

      else if (tipo === "familiar") {
        const miembros = await this.gestorUsuario.obtenerUsuariosDeMiFamilia();
        const ids = miembros.map(m => m.id);

        if (ids.length === 0) {
          return {
            movimientos: [],
            totales: { ingresos: 0, egresos: 0, balance: 0 }
          };
        }

        query = query.in("usuario_id", ids);
      }

      const { data: movimientos, error } = await query;
      if (error) throw error;

      let ingresos = 0;
      let egresos = 0;

      movimientos.forEach(m => {
        if (m.tipo === "ingreso") ingresos += Number(m.monto);
        else egresos += Number(m.monto);
      });

      return {
        movimientos,
        totales: {
          ingresos,
          egresos,
          balance: ingresos - egresos
        }
      };

    } catch (err) {
      console.error("Error en obtenerBalanceEntreFechas:", err);
      throw err;
    }
  }
}