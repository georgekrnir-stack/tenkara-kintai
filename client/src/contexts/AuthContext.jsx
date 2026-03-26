import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [isSetup, setIsSetup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/setup/status')
      .then((res) => setIsSetup(res.data.isSetup))
      .catch(() => setIsSetup(false))
      .finally(() => setLoading(false));
  }, []);

  const login = (newToken) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
    setIsSetup(true);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, isSetup, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
