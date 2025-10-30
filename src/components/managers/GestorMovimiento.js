export class GestorMovimiento { // COD-001
  constructor(supabase, gestorMetas) {
    this.supabase = supabase;
    this.gestorUsuario = gestorMetas;
  }

  // MCOD002-1
  async crearMovimiento({ usuarioId, conceptoId, tipo, monto, comentario, fecha, metaId, montoMeta }) {
    try {
      console.log("Monto que se envía:", monto, typeof monto);

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
      if (movError) throw movError;

      if (tipo === "ingreso" && metaId && montoMeta) {
        const { error: aporteError } = await this.supabase
          .from("aportes_meta")
          .insert([
            {
              meta_id: metaId,
              usuario_id: usuarioId,
              movimiento_id: movimiento.id,
              monto: parseFloat(montoMeta)
            }
          ]);
        if (aporteError) throw aporteError;
      }
      
      const { data: usuarioSaldo, error: errorSaldo } = await this.supabase
        .from("usuarios")
        .select("saldo_disponible")
        .eq("id", usuarioId)

      if (errorSaldo) throw new Error('No se pudo obtener el saldo del usuario');
      console.log("usuario id", usuarioId);
      console.log("saldo dispnible", usuarioSaldo[0].saldo_disponible);
      const nuevoSaldo = parseFloat(usuarioSaldo[0].saldo_disponible)+ monto;
      console.log("nuevo salod", nuevoSaldo);
      if(tipo === "ingreso"){
        const { error: updateMovError } = await this.supabase
        .from("usuarios")
        .update({
          saldo_disponible: nuevoSaldo
        })
        .eq("id", usuarioId);
        if (updateMovError) throw updateMovError;
      }
      return movimiento;
    } catch (err) {
      console.error("MovementsManager error:", err);
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