import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('college_rag_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('college_rag_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyUser = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.user);
          localStorage.setItem('college_rag_user', JSON.stringify(res.data.user));
        } catch (e: any) {
          // Only log out if backend explicitly rejected token with 401 or 403
          if (e.response && (e.response.status === 401 || e.response.status === 403)) {
            logout();
          } else {
            console.warn('⚠️ Could not verify token due to network/server connection issue. Retaining local session.');
          }
        }
      }
      setIsLoading(false);
    };

    verifyUser();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('college_rag_token', newToken);
    localStorage.setItem('college_rag_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('college_rag_token');
    localStorage.removeItem('college_rag_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
