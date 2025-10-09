import { useState, useEffect } from 'react';

export const useSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth < 768) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const closeMobileSidebar = () => {
    if (window.innerWidth < 768) {
      setIsMobileOpen(false);
    }
  };

  return {
    isCollapsed,
    isMobileOpen,
    toggleSidebar,
    closeMobileSidebar
  };
};