import { useEffect, useState } from "react";
import { providers } from "../../services/providers";
import { MdAttachMoney } from "react-icons/md";
import { IoMdTrendingUp } from "react-icons/io";
import { IoMdTrendingDown } from "react-icons/io";

import "../../styles/Dashboard.css";

const { gestorUsuario, gestorMovimientos } = providers;

const Dashboard = () => { // VIEW-008
  const [isLoading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [ingresosTotales, setIngresosTotales] = useState(0);
  const [egresosTotales, setEgresosTotales] = useState(0);
  const [ahorroTotal, setAhorroTotal] = useState(0);
  const [movimientos, setMovimientos] = useState([]);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      try {
        const usuario = await gestorUsuario.obtenerUsuario();
        setUser(usuario);

        const movs = await gestorMovimientos.obtenerMovimientosUsuario(usuario.id, {
          limit: 4,
          ordenar: "desc"
        });

        setMovimientos(movs);

        const hoy = new Date().toLocaleDateString('en-CA');
        const ingresos = await gestorMovimientos.obtenerTotalPorTipo(usuario.id, "ingreso", { fecha: hoy });
        const egresos = await gestorMovimientos.obtenerTotalPorTipo(usuario.id, "egreso", { fecha: hoy });

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
            <div className="icon-box green-icon-bg">
                <span className="icon-placeholder"><IoMdTrendingUp /></span>
            </div>
            <div className="details">
                <div className="amount">S/. {ingresosTotales}</div>
                <div className="label">Ingresos</div>
            </div>
        </div>
        
        <div className="summary-card egreso">
            <div className="icon-box red-icon-bg">
                <span className="icon-placeholder"><IoMdTrendingDown /></span>
            </div>
            <div className="details">
                <div className="amount">S/. {egresosTotales}</div> 
                <div className="label">Egresos</div>
            </div>
        </div>
        
        <div className={`summary-card balancecard ${ahorroTotal < 0 ? 'negativo' : ''}`}>
            <div className="icon-box blue-icon-bg">
                <span className="icon-placeholder"><MdAttachMoney /></span>
            </div>
            <div className="details">
                <div className="amount">S/. {ahorroTotal}</div>
                <div className="label">Balance</div>
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