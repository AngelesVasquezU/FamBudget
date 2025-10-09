import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import SendEmail from './components/SendEmail';
import ResetPassword from './components/ResetPassword';
import DailyInput from './components/DailyInput';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/send-email" element={<SendEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<h2>Bienvenido al panel</h2>} />
        <Route path="/daily-input" element={<DailyInput />} />
      </Routes>
    </Router>
  );
}

export default App;