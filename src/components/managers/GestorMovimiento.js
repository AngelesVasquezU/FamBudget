export class GestorMovimiento { // COD-001
  constructor(supabase, gestorMetas) {
    this.supabase = supabase;
    this.gestorMetas = gestorMetas;
  }

  // MCOD002-1
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

      console.log("✅ Usuario encontrado. Saldo actual:", usuarioData.saldo_disponible);

      const saldoActual = parseFloat(usuarioData.saldo_disponible) || 0;
      console.log("Saldo actual numérico:", saldoActual);

      console.log("2. Creando movimiento...");
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
        console.error("❌ Error al crear movimiento:", movError);
        throw movError;
      }

      // ✅ Si hay meta → DELEGAR todo a agregarAhorro
      if (tipo === "ingreso" && metaId && montoMeta) {
        console.log("➡ Llamando a agregarAhorro con:", {
          metaId,
          montoMeta,
          usuarioId,
          movimientoId: movimiento.id
        });

        await this.gestorMetas.agregarAhorro(
          metaId,
          montoMeta,
          usuarioId,
          movimiento.id
        );

        console.log("✅ agregarAhorro ya actualizó el saldo y la meta.");
        console.log("✅ No se recalcula saldo aquí para evitar duplicados.");

        return movimiento;
      }

      // ✅ Solo actualizamos saldo si NO es un aporte a meta
      console.log("4. Actualizando saldo del usuario (movimiento normal)...");
      const nuevoSaldo = tipo === "ingreso"
        ? saldoActual + parseFloat(monto)
        : saldoActual - parseFloat(monto);

      console.log("Nuevo saldo calculado:", nuevoSaldo);

      const { error: updateError } = await this.supabase
        .from("usuarios")
        .update({
          saldo_disponible: nuevoSaldo
        })
        .eq("id", usuarioId);

      if (updateError) {
        console.error("❌ Error al actualizar saldo:", updateError);
        throw updateError;
      }

      console.log("✅ Saldo actualizado exitosamente a:", nuevoSaldo);
      return movimiento;

    } catch (err) {
      console.error("💥 ERROR COMPLETO en crearMovimiento:", err);
      console.error("Detalles del error:", {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint
      });
      throw err;
    }
  }

    
  // MCOD002-2
  async obtenerTotalPorTipo(usuarioId, tipo, fecha) {
    const { data, error } = await this.supabase
      .from("movimientos")
      .select("monto")
      .eq("usuario_id", usuarioId)
      .eq("tipo", tipo)
      .eq("fecha", fecha);

    if (error) throw error;

    return data.reduce((acc, mov) => acc + parseFloat(mov.monto), 0);
  }

}