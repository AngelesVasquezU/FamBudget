export class GestorMovimiento {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async crearMovimiento({ usuarioId, conceptoId, tipo, monto, comentario, fecha, metaId, montoMeta }) {
    try {
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

      return movimiento;
    } catch (err) {
      console.error("MovementsManager error:", err);
      throw err;
    }
  }

  // Opcional: otras funciones como listar movimientos, filtrar por fecha, calcular totales, etc.
}
