
import { useState, useEffect } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { Dashboard } from '@/components/Dashboard';

// Mock user session - in real app this would be managed via backend/auth service
const ADMIN_USER = {
  username: 'admin',
  password: 'arbitrage2024' // In production, this would be properly hashed/secured
};

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (localStorage for demo)
    const savedAuth = localStorage.getItem('arbitrage_auth');
    if (savedAuth === 'authenticated') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (username: string, password: string): boolean => {
    if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
      setIsAuthenticated(true);
      localStorage.setItem('arbitrage_auth', 'authenticated');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('arbitrage_auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-emerald-400 text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return <Dashboard onLogout={handleLogout} />;
};

export default Index;
