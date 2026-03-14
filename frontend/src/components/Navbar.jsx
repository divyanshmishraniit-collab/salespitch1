import React from 'react';
import { BookOpen, Mic, Target } from 'lucide-react';
import './Navbar.css';

export default function Navbar({ activeTab, setActiveTab, hasBooks }) {
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
          <button
            className={`nav-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <BookOpen size={15} />
            <span>Knowledge Base</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'practice' ? 'active' : ''} ${!hasBooks ? 'disabled' : ''}`}
            onClick={() => hasBooks && setActiveTab('practice')}
            title={!hasBooks ? 'Upload books first' : ''}
          >
            <Mic size={15} />
            <span>Practice</span>
            {!hasBooks && <span className="nav-lock">🔒</span>}
          </button>
        </nav>

        <div className="navbar-badge">
          <span className="badge-dot" />
          NIIT Limited
        </div>
      </div>
    </header>
  );
}