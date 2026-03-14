import React from 'react';
import { BookOpen, Mic, Target, GraduationCap, LogOut } from 'lucide-react';
import './Navbar.css';

export default function Navbar({ activeTab, setActiveTab, hasBooks, userRole, onLogout }) {
  const isAdmin = userRole === 'admin';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <div className="navbar-logo">
            <Target size={18} strokeWidth={2.5} />
          </div>
          <span className="navbar-title">SalesPitch<span className="navbar-title-accent">AI</span></span>
        </div>

        <nav className="navbar-nav">
          {isAdmin && (
            <button
              className={`nav-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <BookOpen size={15} />
              <span>Knowledge Base</span>
            </button>
          )}
          <button
            className={`nav-tab ${activeTab === 'practice' ? 'active' : ''} ${!hasBooks ? 'disabled' : ''}`}
            onClick={() => hasBooks && setActiveTab('practice')}
            title={!hasBooks ? 'Upload books first' : ''}
          >
            <Mic size={15} />
            <span>Practice</span>
            {!hasBooks && <span className="nav-lock">🔒</span>}
          </button>
          <button
            className={`nav-tab ${activeTab === 'tutorial' ? 'active' : ''}`}
            onClick={() => setActiveTab('tutorial')}
          >
            <GraduationCap size={15} />
            <span>Tutorial</span>
          </button>
        </nav>

        <div className="navbar-right">
          <div className="navbar-badge">
            <span className="badge-dot" />
            NIIT Limited
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}