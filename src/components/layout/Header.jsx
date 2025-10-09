import React from 'react';
import { Menu, Bell, Search, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { FiLogOut } from 'react-icons/fi';
import './Header.css';

const Header = ({ toggleSidebar }) => {
  const { signOut } = useAuth();
  return (
    <header className="header">
      <div className="header__left">
        <button 
          className="header__menu-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        
      </div>

      <div className="header__right">
        <div className="logout-link" onClick={signOut}>
          Cerrar Sesión <FiLogOut size={18} style={{ marginLeft: '8px' }} />
        </div>
      </div>
    </header>
  );
};

export default Header;