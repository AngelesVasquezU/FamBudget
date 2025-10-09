import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useSidebar } from '../../hooks/useSidebar';
import './Layout.css';

const Layout = ({ children }) => {
  const { isCollapsed, isMobileOpen, toggleSidebar, closeMobileSidebar } = useSidebar();

  return (
    <div className="layout">
      <Sidebar 
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        toggleSidebar={toggleSidebar}
        closeMobileSidebar={closeMobileSidebar}
      />
      
      <div className={`layout__content ${isCollapsed ? 'layout__content--expanded' : ''}`}>
        <Header toggleSidebar={toggleSidebar} />
        <main className="layout__main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;