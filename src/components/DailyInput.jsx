import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { GestorUsuario } from "./managers/GestorUsuario";
import { GestorMovimiento } from "./managers/GestorMovimiento";
import { GestorConcepto } from "./managers/GestorConcepto";
import { GestorMetas } from "./managers/GestorMeta";

import "../styles/DailyInput.css";

const gestorUsuarios = new GestorUsuario(supabase);
const gestorMovimientos = new GestorMovimiento(supabase);
const gestorConceptos = new GestorConcepto(supabase);
const gestorMetas = new GestorMetas(supabase);

const DailyInput = () => {
  const [tipo, setTipo] = useState("ingreso");
  const MONEDAS = [
    { codigo: "PEN", simbolo: "S/.", nombre: "Soles" },
    { codigo: "USD", simbolo: "$", nombre: "Dólares" },
    { codigo: "EUR", simbolo: "€", nombre: "Euros" }
  ];
  const [tipoMensaje, setTipoMensaje] = useState(""); 
  const [conceptos, setConceptos] = useState([]);
  const [metas, setMetas] = useState([]);
  const fechaActual = new Date().toLocaleDateString("en-CA");
  const [form, setForm] = useState({
    concepto_id: "",
    monto: "",
    comentario: "",
    meta_id: "",
    monto_meta: "",
    fecha: fechaActual,
    moneda: MONEDAS[0].simbolo
  });
  const [message, setMessage] = useState("");
  const [usuarioId, setUsuarioId] = useState(null);
  const [showNewConceptModal, setShowNewConceptModal] = useState(false);
  const [newConcept, setNewConcept] = useState({ nombre: '', tipo: tipo, periodo: 'diario' });

  // useEffect(() => {
  //   const getUser = async () => {
  //     const { data: authData, error } = await supabase.auth.getUser();
  //     if (error) {
  //       console.error("Error al obtener auth user:", error);
  //       return;
  //     }

  //     const authId = authData.user?.id;
  //     if (!authId) {
  //       console.warn("No se encontró auth ID");
  //       return;
  //     }

  //     console.log("Auth ID encontrado:", authId);

  //     const { data: usuario, error: usuarioError } = await supabase
  //       .from("usuarios")
  //       .select("id")
  //       .eq("auth_id", authId)
  //       .single();

  //     if (usuarioError) {
  //       console.error("Error al buscar usuario en tabla usuarios:", usuarioError);
  //       setMessage("Error al buscar usuario");
  //       setTipoMensaje("error");
  //       return;
  //     }
      
  //     if (!usuario) {
  //       setMessage("Usuario no encontrado en la tabla usuarios");
  //       setTipoMensaje("error");
  //       return;
  //     }

  //     setUsuarioId(usuario.id);
  //     console.log("Usuario ID establecido:", usuario.id);
  //   };
    
  //   getUser();
  // }, []);

  useEffect(() => {
    const obtenerUsuario = async () => {
      const id = await gestorUsuarios.obtenerIdUsuario();
      if (id) setUsuarioId(id);
      else console.error("No se pudo obtener el usuario");
    };
    obtenerUsuario();
  }, []);

  useEffect(() => {
    const cargarDatos = async () => {
      if (!usuarioId) return;
        try {
        const conceptosData = await gestorConceptos.obtenerConceptosPorTipo(tipo);

        const metas = await gestorMetas.obtenerMetas(usuarioId);

        setConceptos(conceptosData || []);
        setMetas(metas || []);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };

    if (usuarioId) cargarDatos();
  }, [tipo, usuarioId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   if (!usuarioId) {
  //     setMessage("No se encontró el usuario autenticado");
  //     return;
  //   }

  //   try {
  //     const { data: movimiento, error: movError } = await supabase
  //       .from("movimientos")
  //       .insert([
  //         {
  //           usuario_id: usuarioId,
  //           concepto_id: form.concepto_id || null,
  //           tipo,
  //           monto: parseFloat(form.monto),
  //           comentario: form.comentario || null,
  //           fecha: form.fecha
  //         }
  //       ])
  //       .select()
  //       .single();

  //     if (movError) throw movError;

  //     if (tipo === "ingreso" && form.meta_id && form.monto_meta) {
  //       const { error: aporteError } = await supabase
  //         .from("aportes_meta")
  //         .insert([
  //           {
  //             meta_id: form.meta_id,
  //             usuario_id: usuarioId,
  //             movimiento_id: movimiento.id,
  //             monto: parseFloat(form.monto_meta)
  //           }
  //         ]);
  //       if (aporteError) throw aporteError;
  //     }

  //     setMessage("Movimiento registrado con éxito");
  //     setTipoMensaje("success");
  //     setForm({
  //       concepto_id: "",
  //       monto: "",
  //       comentario: "",
  //       meta_id: "",
  //       monto_meta: "",
  //       fecha: new Date().toISOString().slice(0,10)
  //     });
  //   } catch (error) {
  //     console.error(error);
  //     setMessage(`Error: ${error.message}`);
  //     setTipoMensaje("error");
  //   }
  // };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usuarioId) return alert("No se encontró el usuario");

    try {
      await gestorMovimientos.crearMovimiento({
        usuarioId,
        conceptoId: form.concepto_id,
        tipo,
        monto: form.monto,
        comentario: form.comentario,
        fecha: form.fecha || new Date().toISOString().slice(0, 10),
        metaId: form.meta_id,
        montoMeta: form.monto_meta
      });

      alert("Movimiento registrado con éxito");
      setForm({ concepto_id: "", monto: "", comentario: "", meta_id: "", monto_meta: "" });

    } catch (error) {
      console.error("Error al registrar movimiento:", error);
      alert(`Error: ${error.message}`);
    }
  };


  // const handleAddNewConcept = async () => {
  //   const nombre = newConcept.nombre.trim();
  //   if (!nombre) return alert("El nombre es obligatorio");

  //   try {
  //     const { data, error } = await supabase
  //       .from("conceptos")
  //       .insert([newConcept])
  //       .select()
  //       .single();

  //     if (error) throw error;

  //     setConceptos([...conceptos, data]);
  //     setForm({ ...form, concepto_id: data.id });
  //     setShowNewConceptModal(false);
  //     setNewConcept({ nombre: '', tipo: tipo, periodo: 'diario' });
  //   } catch (err) {
  //     console.error(err);
  //     alert(`Error al agregar concepto: ${err.message}`);
  //   }
  // };

  const handleAddNewConcept = async () => {
    try {
      await gestorConceptos.agregarConcepto({
        nombre: newConcept.nombre,
        tipo: newConcept.tipo,
        periodo: newConcept.periodo
      });
      setShowNewConceptModal(false);
      const data = await gestorConceptos.obtenerConceptosPorTipo(tipo);
      setConceptos(data);
    } catch (error) {
      console.error("Error al agregar concepto:", error);
      alert("No se pudo agregar el concepto");
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
        <label>Fecha</label>
        <input
          type="date"
          name="fecha"
          value={form.fecha}
          onChange={handleChange}
          max={fechaActual}
          required
        />
        <label>Concepto</label>
        <div className="concepto-select-container">
          <select
            name="concepto_id"
            value={form.concepto_id}
            onChange={handleChange}
            required
            className="concepto-select"
          >
            <option value="">Selecciona un concepto</option>
            {conceptos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewConceptModal(!showNewConceptModal)}
            className="btn-nuevo-concepto"
          > Nuevo
          </button>
        </div>
        {showNewConceptModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Nuevo Concepto</h3>

              <label>Nombre</label>
              <input
                type="text"
                value={newConcept.nombre}
                onChange={(e) => setNewConcept({ ...newConcept, nombre: e.target.value })}
              />

              <label>Tipo</label>
              <select
                value={newConcept.tipo}
                onChange={(e) => setNewConcept({ ...newConcept, tipo: e.target.value })}
              >
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>

              <label>Periodicidad</label>
              <select
                value={newConcept.periodo}
                onChange={(e) => setNewConcept({ ...newConcept, periodo: e.target.value })}
              >
                <option value="diario">Diario</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>

              <div className="modal-buttons">
                <button onClick={handleAddNewConcept}>Agregar</button>
                <button onClick={() => setShowNewConceptModal(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        <label>Monto ({form.moneda})</label>
        <input
          type="number"
          name="monto"
          value={form.monto}
          onChange={handleChange}
          placeholder={`${form.moneda} 0.00`}
          min={0.50}
          step={0.10}
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
                  placeholder={`${form.moneda} 0.00`}
                  min={0.50}
                  step={0.10}
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