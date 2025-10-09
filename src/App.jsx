import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Login from './components/Login';
import Register from './components/Register';
import SendEmail from './components/SendEmail';
import ResetPassword from './components/ResetPassword';
import Dashboard from './pages/Dashboard';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/send-email" element={<SendEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;