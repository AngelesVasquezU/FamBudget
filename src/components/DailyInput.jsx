import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import "./DailyInput.css";

const DailyInput = () => {
  const [tipo, setTipo] = useState("ingreso");
  const [conceptos, setConceptos] = useState([]);
  const [metas, setMetas] = useState([]);
  const [form, setForm] = useState({
    concepto_id: "",
    monto: "",
    descripcion: "",
    meta_id: "",
    monto_meta: ""
  });
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const [usuarioId, setUsuarioId] = useState(null);
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUsuarioId(data.user.id);
    };
    getUser();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: conceptosData } = await supabase
        .from("conceptos")
        .select("*")
        .eq("tipo", tipo);

      const { data: metasData } = await supabase
        .from("metas")
        .select("*")
        .eq("usuario_id", usuarioId);

      setConceptos(conceptosData || []);
      setMetas(metasData || []);
    };

    if (usuarioId) fetchData();
  }, [tipo, usuarioId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  // ✅ Enviar movimiento
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usuarioId) {
      setMessage("No se encontró el usuario autenticado");
      return;
    }

    try {
      // 1️⃣ Insertar movimiento
      const { data: movimiento, error: movError } = await supabase
        .from("movimientos")
        .insert([
          {
            usuario_id: usuarioId,
            concepto_id: form.concepto_id || null,
            tipo,
            monto: parseFloat(form.monto),
            descripcion: form.descripcion || null
          }
        ])
        .select()
        .single();

      if (movError) throw movError;

      // 2️⃣ Si es ingreso con meta, insertar en aportes_meta
      if (tipo === "ingreso" && form.meta_id && form.monto_meta) {
        const { error: aporteError } = await supabase
          .from("aportes_meta")
          .insert([
            {
              meta_id: form.meta_id,
              usuario_id: usuarioId,
              movimiento_id: movimiento.id,
              monto: parseFloat(form.monto_meta)
            }
          ]);
        if (aporteError) throw aporteError;
      }

      setMessage("✅ Movimiento registrado con éxito");
      setForm({
        concepto_id: "",
        monto: "",
        descripcion: "",
        meta_id: "",
        monto_meta: ""
      });
    } catch (error) {
      console.error(error);
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="registro-container">
      <h2>Registrar movimiento</h2>

      <div className="tipo-selector">
        <button
          className={tipo === "ingreso" ? "active" : ""}
          onClick={() => setTipo("ingreso")}
        >
          Ingreso
        </button>
        <button
          className={tipo === "egreso" ? "active" : ""}
          onClick={() => setTipo("egreso")}
        >
          Egreso
        </button>
      </div>

      <form className="registro-form" onSubmit={handleSubmit}>
        <label>Concepto</label>
        <select
          name="concepto_id"
          value={form.concepto_id}
          onChange={handleChange}
          required
        >
          <option value="">Selecciona un concepto</option>
          {conceptos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <label>Monto</label>
        <input
          type="number"
          name="monto"
          value={form.monto}
          onChange={handleChange}
          placeholder="0.00"
          required
        />

        <label>Descripción</label>
        <textarea
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          placeholder="Ej. compra de alimentos, salario mensual..."
        ></textarea>

        {tipo === "ingreso" && (
          <>
            <hr />
            <h3>💰 Ahorro / Meta (opcional)</h3>

            <label>Meta asociada</label>
            <select
              name="meta_id"
              value={form.meta_id}
              onChange={handleChange}
            >
              <option value="">Ninguna</option>
              {metas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>

            {form.meta_id && (
              <>
                <label>Monto a destinar a la meta</label>
                <input
                  type="number"
                  name="monto_meta"
                  value={form.monto_meta}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </>
            )}
          </>
        )}

        <button type="submit" className="btn-guardar">
          Guardar movimiento
        </button>
      </form>

      {message && <p className="mensaje">{message}</p>}

      <button className="volver-btn" onClick={() => navigate("/dashboard")}>
        ⬅ Volver al dashboard
      </button>
    </div>
  );
};

export default DailyInput;
