import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "./DailyInput.css";

const DailyInput = () => {
  const [tipo, setTipo] = useState("ingreso");
  const [tipoMensaje, setTipoMensaje] = useState(""); 
  const [conceptos, setConceptos] = useState([]);
  const [metas, setMetas] = useState([]);
  const [form, setForm] = useState({
    concepto_id: "",
    monto: "",
    comentario: "",
    meta_id: "",
    monto_meta: ""
  });
  const [message, setMessage] = useState("");
  const [usuarioId, setUsuarioId] = useState(null);
  useEffect(() => {
    const getUser = async () => {
      const { data: authData, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error al obtener auth user:", error);
        return;
      }

      const authId = authData.user?.id;
      if (!authId) {
        console.warn("No se encontró auth ID");
        return;
      }

      const { data: usuario, error: usuarioError } = await supabase
        .from("usuarios")
        .select("id")
        .eq("auth_id", authId)
        .single();

      if (usuarioError) {
        console.error("Error al buscar usuario en tabla usuarios:", usuarioError);
        setMessage("Error al buscar usuario");
        setTipoMensaje("error");
        return;
      }
      
      if (!usuario) {
        setMessage("Usuario no encontrado en la tabla usuarios");
        setTipoMensaje("error");
        return;
      }

      setUsuarioId(usuario.id);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usuarioId) {
      setMessage("No se encontró el usuario autenticado");
      return;
    }

    try {
      
      const { data: movimiento, error: movError } = await supabase
        .from("movimientos")
        .insert([
          {
            usuario_id: usuarioId,
            concepto_id: form.concepto_id || null,
            tipo,
            monto: parseFloat(form.monto),
            comentario: form.comentario || null
          }
        ])
        .select()
        .single();

      if (movError) throw movError;

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

      setMessage("Movimiento registrado con éxito");
      setTipoMensaje("success");
      setForm({
        concepto_id: "",
        monto: "",
        comentario: "",
        meta_id: "",
        monto_meta: ""
      });
    } catch (error) {
      console.error(error);
      setMessage(`Error: ${error.message}`);
      setTipoMensaje("error");
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

        <label>Comenterio (opcional)</label>
        <textarea
          name="comentario"
          value={form.comentario}
          onChange={handleChange}
          placeholder="Ej. compra de alimentos, salario mensual..."
        ></textarea>

        {tipo === "ingreso" && (
          <>
            <hr />
            <h3>Meta (opcional)</h3>

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
        
      <p className={`mensaje ${tipoMensaje}`}>{message}</p>

    </div>
  );
};

export default DailyInput;