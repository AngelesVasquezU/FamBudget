import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
                                    <p>Ingresos: {d.ingresos}</p>
                                    <p>Egresos: {d.egresos}</p>
                                    <p>Desde: {d.fechaInicio}</p>
                                    <p>Hasta: {d.fechaFin}</p>
                                </div>
                            );
                        }}
                    />

                    <Bar dataKey="ingresos" fill="#2a4672" radius={[4, 4, 0, 0]} barSize={50} />
                    <Bar dataKey="egresos" fill="#ff6b6b" radius={[4, 4, 0, 0]} barSize={50} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
