import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Recuperar from './components/Recuperar';
import ResetPassword from './components/ResetPassword';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<h2>Bienvenido al panel</h2>} />
      </Routes>
    </Router>
  );
}

export default App;