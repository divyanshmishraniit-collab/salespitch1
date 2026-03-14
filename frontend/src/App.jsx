import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthGate from './components/AuthGate';
import UploadPage from './pages/UploadPage';
import PracticePage from './pages/PracticePage';
import TutorialPage from './pages/TutorialPage';
import './App.css';

const AUTH_KEY = 'sales_app_authed';

export default function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedBooks, setUploadedBooks] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    sessionStorage.getItem(AUTH_KEY) === 'true'
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

  const handleAuthSuccess = () => {
    sessionStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
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
      />
      <main className="app-main">
        {activeTab === 'upload' && (
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