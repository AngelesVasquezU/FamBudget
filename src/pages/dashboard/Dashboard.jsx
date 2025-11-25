import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { GestorUsuario } from "../../api/GestorUsuario";
import { GestorMetas } from "../../api/GestorMeta";
import { GestorMovimiento } from "../../api/GestorMovimiento";
import { MdAttachMoney } from "react-icons/md";
import { IoMdTrendingUp } from "react-icons/io";
import { IoMdTrendingDown } from "react-icons/io";

import "../../styles/Dashboard.css";

const Dashboard = () => { // VIEW-008
  const [isLoading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [ingresosTotales, setIngresosTotales] = useState(0);
  const [egresosTotales, setEgresosTotales] = useState(0);
  const [ahorroTotal, setAhorroTotal] = useState(0);
  const [movimientos, setMovimientos] = useState([]);

  const gestorUsuario = new GestorUsuario(supabase);
  const gestorMeta = new GestorMetas(supabase, gestorUsuario);
  const gestorMovimiento = new GestorMovimiento(supabase, gestorMeta);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      try {
        const usuario = await gestorUsuario.obtenerUsuario();
        setUser(usuario);

        const movs = await gestorMovimiento.obtenerMovimientosUsuario(usuario.id, {
          limit: 4,
          ordenar: "desc"
        });

        setMovimientos(movs);
        console.log("movimientos del usuarios: ", movs);

        const hoy = new Date().toLocaleDateString('en-CA');
        const ingresos = await gestorMovimiento.obtenerTotalPorTipo(usuario.id, "ingreso", hoy);
        const egresos = await gestorMovimiento.obtenerTotalPorTipo(usuario.id, "egreso", hoy);

        const ahorro = Math.round((ingresos - egresos)* 100) / 100;

        setIngresosTotales(ingresos);
        setEgresosTotales(egresos);
        setAhorroTotal(ahorro);
      } catch (err) {
        console.error("Error cargando dashboard:", err);
      }

      setLoading(false);
    };

    cargar();
  }, []);

  if (isLoading) {
    return (
      <div className="dashboars">
        <div className="loading">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h1>¡Hola, {user?.nombre || "Bienvenido"}!</h1>
        <p className="dashboard__subtitle">
          Tu <span className="dashboard__highlight">Resumen</span> de hoy ({new Date().toLocaleDateString()})
        </p>
      </div>

      <div className="dashboard-summary">
        <div className="summary-card ingreso">
            <div class="icon-box green-icon-bg">
                <span class="icon-placeholder"><IoMdTrendingUp /></span>
            </div>
            <div className="details">
                <div class="amount">S/. {ingresosTotales}</div>
                <div class="label">Ingresos</div>
            </div>
        </div>
        
        <div className="summary-card egreso">
            <div class="icon-box red-icon-bg">
                <span class="icon-placeholder"><IoMdTrendingDown /></span>
            </div>
            <div className="details">
                <div class="amount">S/. {egresosTotales}</div> 
                <div class="label">Egresos</div>
            </div>
        </div>
        
        <div className={`summary-card balancecard ${ahorroTotal < 0 ? 'negativo' : ''}`}>
            <div class="icon-box blue-icon-bg">
                <span class="icon-placeholder"><MdAttachMoney /></span>
            </div>
            <div className="details">
                <div class="amount">S/. {ahorroTotal}</div>
                <div class="label">Balance</div>
            </div>
        </div>
    </div>

      <div className="dashboard-lower">

        <div className="recent-movements">
          <h3>Movimientos Recientes</h3>
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Concepto</th>
                <th>Fecha</th>
                <th>Monto</th>
              </tr>
            </thead>

            <tbody>
              {movimientos.slice(0, 4).map(m => (
                <tr key={m.id}>
                  <td>{m.comentario || "Sin descripcion"} </td>
                  <td>{m.conceptos.nombre}</td>
                  <td>{m.fecha}</td>
                  <td className={m.tipo === "egreso" ? "negativo" : "positivo"}>
                    {m.tipo === "egreso" ? "-" : "+"} S/. {m.monto}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;