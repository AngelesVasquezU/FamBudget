import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { GestorUsuario } from "./managers/GestorUsuario";
import { GestorMovimiento } from "./managers/GestorMovimiento";
import { GestorConcepto } from "./managers/GestorConcepto";
import { GestorMetas } from "./managers/GestorMeta";

import "../styles/RegistroDiario.css";

const gestorUsuario = new GestorUsuario(supabase);
const gestorMetas = new GestorMetas(supabase);
const gestorMovimientos = new GestorMovimiento(supabase, gestorMetas);
const gestorConceptos = new GestorConcepto(supabase, gestorUsuario);

const RegistroDiario = () => { // COD-001
  const [tipo, setTipo] = useState("ingreso");
  const MONEDAS = [
    { codigo: "PEN", simbolo: "S/.", nombre: "Soles" },
    { codigo: "USD", simbolo: "$", nombre: "Dólares" },
    { codigo: "EUR", simbolo: "€", nombre: "Euros" }
  ];
  const [resumenDia, setResumenDia] = useState({ ingresos: 0, egresos: 0 });
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [conceptos, setConceptos] = useState([]);
  const [metas, setMetas] = useState([]);
  const fechaActual = new Date().toLocaleDateString("en-CA");
  const [form, setForm] = useState({
    concepto_id: "",
    monto: 0,
    comentario: "",
    meta_id: "",
    monto_meta: 0,
    fecha: fechaActual,
    moneda: MONEDAS[0].simbolo
  });
  const [message, setMessage] = useState("");
  const [usuarioId, setUsuarioId] = useState(null);
  const [showNewConceptModal, setShowNewConceptModal] = useState(false);
  const [newConcept, setNewConcept] = useState({ nombre: '', tipo: tipo, periodo: 'diario' });

  useEffect(() => {  // MCOD001-1
    const obtenerUsuario = async () => {
      const id = await gestorUsuario.obtenerIdUsuario();
      if (id) setUsuarioId(id);
      else console.error("No se pudo obtener el usuario");
    };
    obtenerUsuario();
  }, []);

  useEffect(() => {  // MCOD001-2
    const cargarDatos = async () => {
      if (!usuarioId) {
        setMessage("Usuario no encontrado");
        setTipoMensaje("error");
        return;
      }
      try {
        const conceptosData = await gestorConceptos.obtenerConceptosPorTipo(tipo);
        setConceptos(conceptosData || []);
        await cargarMetas();
      } catch (error) {
        console.error("Error al buscar usuario en tabla usuarios:", error);
        setMessage("Error al buscar usuario", error);
        setTipoMensaje("error");
      }
    };

    if (usuarioId) cargarDatos();
  }, [tipo, usuarioId]);

  useEffect(() => {  // MCOD001-3
    const cargarResumen = async () => {
      if (!usuarioId) return;

      const fechaHoy = new Date().toISOString().slice(0, 10);
      try {
        const ingresos = await gestorMovimientos.obtenerTotalPorTipo(usuarioId, 'ingreso', fechaHoy);
        const egresos = await gestorMovimientos.obtenerTotalPorTipo(usuarioId, 'egreso', fechaHoy);
        setResumenDia({ ingresos: ingresos || 0, egresos: egresos || 0 });
      } catch (error) {
        console.error("Error al obtener resumen diario:", error);
      }
    };

    cargarResumen();
  }, [usuarioId, tipo]);

  const handleChange = (e) => {   // MCOD001-4
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };
  const cargarMetas = async () => {
    if (!usuarioId) return;
    try {
      const metasData = await gestorMetas.obtenerMetas(usuarioId);
      setMetas(metasData || []);
    } catch (error) {
      console.error("Error al cargar metas:", error);
    }
  };
  const handleSubmit = async (e) => {  // MCOD001-5
    e.preventDefault();
    if (!usuarioId) {
      setMessage("No se encontró el usuario autenticado");
      return;
    }
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

      setMessage("Movimiento registrado con éxito");
      setTipoMensaje("success");
      setForm({ concepto_id: "", monto: 0, comentario: "", meta_id: "", monto_meta: 0 });

      // ✅ AGREGAR ESTO: Disparar evento para actualizar metas
      if (form.meta_id && form.monto_meta) {
        console.log('📢 Disparando evento: metas actualizadas desde RegistroDiario');
        window.dispatchEvent(new CustomEvent('metasActualizadas'));
      }

    } catch (error) {
      console.error("Error al registrar movimiento:", error);
      setMessage(`Error: ${error.message}`);
      setTipoMensaje("error");
    }
  };

  const handleAddNewConcept = async () => {   // MCOD001-6
    try {
      await gestorConceptos.crearConcepto({
        nombre: newConcept.nombre,
        tipo: newConcept.tipo,
        periodo: newConcept.periodo,
      });
      setShowNewConceptModal(false);
      const data = await gestorConceptos.obtenerConceptosPorTipo(tipo);
      setConceptos(data);
    } catch (error) {
      console.log("Error al agregar concepto:", error);
      setMessage("No se pudo agregar el concepto");
    }
  };

  return (
    <div className="registro-container">
      <h2>Registrar movimiento</h2>
      <div className="resumen-dia">
        <h3>Resumen del día ({fechaActual})</h3>
        <p>Ingresos: {form.moneda} {resumenDia.ingresos.toFixed(2)}</p>
        <p>Egresos: {form.moneda} {resumenDia.egresos.toFixed(2)}</p>
      </div>
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
            {conceptos && conceptos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setNewConcept({ nombre: '', tipo: tipo, periodo: 'diario' });
              setShowNewConceptModal(true);
            }}
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
                <button type="button" onClick={handleAddNewConcept}>Agregar</button>
                <button type="button" onClick={() => setShowNewConceptModal(false)}>Cancelar</button>
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

export default RegistroDiario;