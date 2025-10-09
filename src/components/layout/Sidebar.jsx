import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Calendar, 
  PieChart, 
  Settings, 
  Target, 
  User,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ 
  isCollapsed, 
  isMobileOpen, 
  toggleSidebar, 
  closeMobileSidebar,
  currentFamily = "Familia Rodríguez"
}) => {
  const location = useLocation(); 
  const menuItems = [
    { icon: Home, label: 'Inicio',  path: '/dashboard', active: true },
    { icon: Calendar, label: 'Registro Diario', path: '/registro-diario'  },
    { icon: PieChart, label: 'Balance', path: '/balance' },
    { icon: Settings, label: 'Configuración', path: '/configuracion' },
    { icon: Target, label: 'Metas', path: '/metas' },
    { icon: User, label: 'Cuenta' , path: '/cuenta'}
  ];


  return (
    <>
      {isMobileOpen && (
        <div 
          className="sidebar-overlay"
          onClick={closeMobileSidebar}
        />
      )}

      <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''} ${isMobileOpen ? 'sidebar--mobile-open' : ''}`}>
        <div className="sidebar__header">
          {!isCollapsed && (
            <div className="sidebar__brand">
              <div className="sidebar__title">
                <h2>FamBudget</h2>
                <span className="sidebar__family">{currentFamily}</span>
              </div>
            </div>
          )}
          
          <button 
            className="sidebar__toggle"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="sidebar__nav">
          <ul className="sidebar__menu">
            {menuItems.map((item, index) => {
              const isActive = location.pathname === item.path; // 👈 Compara ruta
              return (
                <li key={index} className="sidebar__menu-item">
                  <Link
                    to={item.path}
                    className={`sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                    onClick={closeMobileSidebar}
                  >
                    <item.icon size={20} className="sidebar__icon" />
                    {!isCollapsed && <span className="sidebar__label">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {!isCollapsed && (
          <div className="sidebar__footer">
            <div className="sidebar__user">
              <div className="user-avatar">T</div>
              <div className="user-info">
                <span className="user-name">Tú</span>
                <span className="user-role">Administrador</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;