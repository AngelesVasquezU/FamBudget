import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { GestorUsuario } from "../../api/GestorUsuario";
import { GestorMetas } from "../../api/GestorMeta";
import { GestorMovimiento } from "../../api/GestorMovimiento";
import "../../styles/Dashboard.css";

const Dashboard = () => {
  const [isLoading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [ingresosTotales, setIngresosTotales] = useState(0);
  const [egresosTotales, setEgresosTotales] = useState(0);
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

        const ingresos = await gestorMovimiento.obtenerTotalPorTipo(usuario.id, "ingreso");
        const egresos = await gestorMovimiento.obtenerTotalPorTipo(usuario.id, "egreso");

        setIngresosTotales(ingresos);
        setEgresosTotales(egresos);
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
      </div>

      <div className="dashboard-summary">
        <div className="summary-card ingreso">
          <p>Ingresos</p>
          <span>S/. {ingresosTotales}</span>
        </div>

        <div className="summary-card egreso">
          <p>Egresos</p>
          <span>S/. {egresosTotales}</span>
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
                  <td>{new Date(m.fecha).toLocaleDateString()}</td>
                  <td className={m.tipo === "egreso" ? "negativo" : "positivo"}>
                    {m.tipo === "egreso" ? "-" : "+"} S/. {m.monto}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Aquí va el gráfico 
        <div className="dashboard-chart">
          <h3>Mensual</h3>
        </div>
        */}

      </div>
    </div>
  );
};

export default Dashboard;