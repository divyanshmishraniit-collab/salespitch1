import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthGate from './components/AuthGate';
import UploadPage from './pages/UploadPage';
import PracticePage from './pages/PracticePage';
import TutorialPage from './pages/TutorialPage';
import './App.css';

const AUTH_KEY = 'sales_app_authed';
const ROLE_KEY = 'sales_app_role';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    // If returning user is not admin, default to 'practice' so they don't
    // land on the hidden 'upload' tab
    const savedRole = sessionStorage.getItem(ROLE_KEY);
    return savedRole === 'admin' ? 'upload' : 'practice';
  });

  const [uploadedBooks, setUploadedBooks] = useState([]);

  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    sessionStorage.getItem(AUTH_KEY) === 'true'
  );

  const [userRole, setUserRole] = useState(() =>
    sessionStorage.getItem(ROLE_KEY) || null
  );

  const fetchUploadedBooks = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/list-books`);
      const data = await res.json();
      setUploadedBooks(data.success ? data.books : []);
    } catch {
      setUploadedBooks([]);
    }
  };

  useEffect(() => {
    fetchUploadedBooks();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    setIsAuthenticated(false);
    setUserRole(null);
  };

  const handleAuthSuccess = (role) => {
    sessionStorage.setItem(AUTH_KEY, 'true');
    sessionStorage.setItem(ROLE_KEY, role);
    setIsAuthenticated(true);
    setUserRole(role);
    // Send non-admins straight to Practice since they can't see Knowledge Base
    setActiveTab(role === 'admin' ? 'upload' : 'practice');
  };

  if (!isAuthenticated) {
    return <AuthGate onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasBooks={uploadedBooks.length > 0}
        userRole={userRole}
        onLogout={handleLogout}
      />
      <main className="app-main">
        {activeTab === 'upload' && userRole === 'admin' && (
          <UploadPage
            uploadedBooks={uploadedBooks}
            fetchUploadedBooks={fetchUploadedBooks}
            onStartSession={() => setActiveTab('practice')}
          />
        )}
        {activeTab === 'practice' && (
          <PracticePage uploadedBooks={uploadedBooks} />
        )}
        {activeTab === 'tutorial' && <TutorialPage />}
      </main>
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} NIIT Limited. All rights reserved.</span>
      </footer>
    </div>
  );
}