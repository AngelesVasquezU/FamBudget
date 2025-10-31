export class GestorMovimiento { // COD-001
  constructor(supabase, gestorMetas) {
    this.supabase = supabase;
    this.gestorUsuario = gestorMetas;
  }

  // MCOD002-1
  async crearMovimiento({ usuarioId, conceptoId, tipo, monto, comentario, fecha, metaId, montoMeta }) {
    try {
      console.log("=== INICIANDO crearMovimiento ===");
      console.log("Usuario ID:", usuarioId);
      console.log("Monto que se envía:", monto, typeof monto);

      // 1. Primero obtener el saldo actual del usuario
      console.log("1. Obteniendo saldo actual del usuario...");
      const { data: usuarioData, error: errorSaldo } = await this.supabase
        .from("usuarios")
        .select("saldo_disponible")
        .eq("id", usuarioId)
        .single();

      if (errorSaldo) {
        console.error("❌ Error al obtener saldo:", errorSaldo);
        throw new Error('No se pudo obtener el saldo del usuario: ' + errorSaldo.message);
      }

      if (!usuarioData) {
        console.error("❌ No se encontró el usuario con ID:", usuarioId);
        throw new Error('Usuario no encontrado en la base de datos');
      }

      console.log("✅ Usuario encontrado. Saldo actual:", usuarioData.saldo_disponible);

      const saldoActual = parseFloat(usuarioData.saldo_disponible) || 0;
      console.log("Saldo actual numérico:", saldoActual);

      // 2. Crear el movimiento
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

      console.log("✅ Movimiento creado:", movimiento.id);

      // 3. Manejar aporte a meta si aplica
      if (tipo === "ingreso" && metaId && montoMeta) {
        console.log("3. Creando aporte a meta...");
        
        const { error: aporteError } = await this.supabase
          .from("aportes_meta")
          .insert([
            {
              meta_id: metaId,
              movimiento_id: movimiento.id,
              monto: parseFloat(montoMeta)
            }
          ]);

        if (aporteError) {
          console.error("❌ Error al crear aporte_meta:", aporteError);
          throw aporteError;
        }
        console.log("✅ Aporte a meta creado exitosamente");
      }
      
      // 4. Calcular y actualizar nuevo saldo
      console.log("4. Actualizando saldo del usuario...");
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