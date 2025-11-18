import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function BalanceChart({ data }) {
    console.log("data", data);
    return (
        <div style={{ width: "100%", height: 300, marginTop: "20px" }}>
            <ResponsiveContainer>
                <BarChart data={data}>
                    <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" interval={0} padding={{ left: 20, right: 20 }} />

                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="ingresos" fill="#2a4672" radius={[4, 4, 0, 0]} barSize={50} />
                    <Bar dataKey="egresos" fill="#ff6b6b" radius={[4, 4, 0, 0]} barSize={50} />

                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
