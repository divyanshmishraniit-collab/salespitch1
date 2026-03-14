import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import './AuthGate.css';

export default function AuthGate({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async () => {
    if (!password.trim()) return;
    setIsVerifying(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Could not connect to server. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-bg" />
      <div className="auth-card animate-fadeUp">
        <div className="auth-icon">
          <Lock size={22} strokeWidth={2} />
        </div>
        <h1 className="auth-title">Sales Pitch AI</h1>
        <p className="auth-subtitle">Enter your access code to continue</p>

        <div className="auth-field">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Access code"
            className={`auth-input ${error ? 'error' : ''}`}
            autoFocus
          />
          {error && <p className="auth-error">{error}</p>}
        </div>

        <button
          className="auth-btn"
          onClick={handleSubmit}
          disabled={isVerifying || !password.trim()}
        >
          {isVerifying ? (
            <span className="auth-spinner" />
          ) : (
            <>
              <span>Continue</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <p className="auth-footer">© {new Date().getFullYear()} NIIT Limited</p>
      </div>
    </div>
  );
}