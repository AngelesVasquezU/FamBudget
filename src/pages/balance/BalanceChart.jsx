import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CustomLegend = () => (
  <div style={{
    display: "flex",
    justifyContent: "center",
    gap: "40px",
    marginTop: "20px",
    fontSize: "14px"
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ width: 14, height: 14, background: "#2a4672", borderRadius: 3 }}></div>
      <span>Ingresos</span>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ width: 14, height: 14, background: "#ff6b6b", borderRadius: 3 }}></div>
      <span>Egresos</span>
    </div>
  </div>
);

// Componente para mostrar el gráfico de balance con barras de ingresos y egresos.
export default function BalanceChart({ data }) {
    return (
        <div style={{ width: "100%", height: 300, marginTop: "20px" }}>
            <ResponsiveContainer>
                <BarChart data={data}>
                    <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                    <XAxis dataKey="label" interval={0} padding={{ left: 20, right: 20 }} />
                    <YAxis />

                    <Tooltip
                        content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const d = payload[0].payload;
                            return (
                                <div style={{ background: "#fff", padding: "10px", border: "1px solid #ccc" }}>
                                    <p><strong>{d.label}</strong></p>
                                    <p>Ingresos: S/. {d.ingresos}</p>
                                    <p>Egresos: S/. {d.egresos}</p>
                                    <p>Desde: {d.fechaInicio}</p>
                                    <p>Hasta: {d.fechaFin}</p>
                                </div>
                            );
                        }}
                    />

                    <Bar dataKey="ingresos" name="Ingresos" fill="#2a4672" radius={[4, 4, 0, 0]} barSize={50} />
                    <Bar dataKey="egresos"  name="Egresos" fill="#ff6b6b" radius={[4, 4, 0, 0]} barSize={50} />
                    <Legend content={<CustomLegend />} />

                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
