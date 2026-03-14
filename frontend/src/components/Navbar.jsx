import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Upload, Mic, BookOpen, LogOut, ChevronDown } from 'lucide-react';
import './Navbar.css';

export default function Navbar({ activeTab, setActiveTab, hasBooks, userRole, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  const tabs = [
    ...(userRole === 'admin' ? [{ id: 'upload', label: 'Knowledge Base', icon: Upload }] : []),
    { id: 'practice', label: 'Practice', icon: Mic },
    { id: 'tutorial', label: 'Scenarios', icon: BookOpen },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close menu on tab change
  const handleTabChange = (id) => {
    setActiveTab(id);
    setMenuOpen(false);
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`} ref={menuRef}>
      <div className="navbar-inner">
        {/* Logo */}
        <div className="navbar-brand">
          <div className="navbar-logo">
            <img src="/NIIT_logo.svg" alt="NIIT" className="navbar-logo-img" />
          </div>
          <div className="navbar-brand-text">
            <span className="navbar-title">Sales Coach</span>
            <span className="navbar-sub">NIIT</span>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="navbar-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`navbar-tab ${activeTab === tab.id ? 'navbar-tab--active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop logout */}
        <div className="navbar-actions">
          <button className="navbar-logout" onClick={onLogout}>
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className={`navbar-hamburger ${menuOpen ? 'navbar-hamburger--open' : ''}`}
          onClick={() => setMenuOpen(prev => !prev)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <div className={`navbar-mobile-menu ${menuOpen ? 'navbar-mobile-menu--open' : ''}`}>
        <div className="navbar-mobile-inner">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`navbar-mobile-tab ${isActive ? 'navbar-mobile-tab--active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <div className="navbar-mobile-tab-left">
                  <div className={`navbar-mobile-icon ${isActive ? 'navbar-mobile-icon--active' : ''}`}>
                    <Icon size={16} />
                  </div>
                  <span>{tab.label}</span>
                </div>
                {isActive && <div className="navbar-mobile-active-dot" />}
              </button>
            );
          })}

          <div className="navbar-mobile-divider" />

          <button className="navbar-mobile-logout" onClick={() => { onLogout(); setMenuOpen(false); }}>
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}