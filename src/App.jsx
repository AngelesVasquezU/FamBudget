import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import IniciarSesion from './components/IniciarSesion';
import Registro from './components/Registro';
import SendEmail from './components/SendEmail';
import ResetPassword from './components/ResetPassword';
import Dashboard from './components/Dashboard';
import Conceptos from './components/Conceptos';
import Familia from './components/Familia';
import Cuenta from './components/Cuenta';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RegistroDiario from './components/RegistroDiario';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<IniciarSesion />} />
          <Route path="/login" element={<IniciarSesion />} />
          <Route path="/register" element={<Registro />} />
          <Route path="/send-email" element={<SendEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/configuracion" element={
            <ProtectedRoute>
              <Layout>
                <Conceptos />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/registro-diario" element={
            <ProtectedRoute>
              <Layout>
                <RegistroDiario />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/familia" element={
            <ProtectedRoute>
              <Layout>
                <Familia />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/cuenta" element={
            <ProtectedRoute>
              <Layout>
                <Cuenta />
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;