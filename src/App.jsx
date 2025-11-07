import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Auth 
import IniciarSesion from './pages/auth/IniciarSesion';
import Registro from './pages/auth/Registro';
import SendEmail from './pages/auth/SendEmail';
import ResetPassword from './pages/auth/ResetPassword';

// Pages
import Dashboard from './pages/dashboard/Dashboard';
import Conceptos from './pages/conceptos/Conceptos';
import Familia from './pages/familia/Familia';
import Cuenta from './pages/cuenta/Cuenta';
import Metas from './pages/metas/Metas';
import ProtectedRoute from './routes/ProtectedRoute';
import RegistroDiario from './pages/registro-diario/RegistroDiario';
import Layout from './layout/Layout';
import './App.css';

const privateRoutes = [
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/configuracion", element: <Conceptos />, roles: ["Administrador"] },
  { path: "/registro-diario", element: <RegistroDiario /> },
  { path: "/familia", element: <Familia /> },
  { path: "/cuenta", element: <Cuenta /> },
  { path: "/metas", element: <Metas /> },
  { path: "/metas/editar/:id", element: <Metas /> },
  { path: "/balance", element: <div>En desarrollo...</div> },
];

const BaseRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return user
    ? <Navigate to="/dashboard" replace />
    : <IniciarSesion />;
};


function App() {

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BaseRedirect />} />
          <Route path="/login" element={<Navigate to="/" />} />
          <Route path="/register" element={<Registro />} />
          <Route path="/send-email" element={<SendEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {privateRoutes.map(({ path, element, roles }) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute roles={roles}>
                  <Layout>{element}</Layout>
                </ProtectedRoute>
              }
            />
          ))}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;