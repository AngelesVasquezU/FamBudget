import { useAuth } from '../hooks/useAuth';
import { FiLogOut } from 'react-icons/fi';
import './Header.css';

const Header = () => {
  const { signOut } = useAuth();
  return (
    <header className="header">
      <div className="logout-link" onClick={signOut}>
        Cerrar Sesión <FiLogOut size={18} style={{ marginLeft: '8px' }} />
      </div>
    </header>
  );
};

export default Header;