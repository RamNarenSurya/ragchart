import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isDemoMode: boolean;
  login: (token: string, user: User) => void;
  loginAsDemoUser: (role?: UserRole) => void;
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

  const isDemoMode = token === 'demo_token_xyz';

  useEffect(() => {
    const verifyUser = async () => {
      if (token && !isDemoMode) {
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
  }, [token, isDemoMode]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('college_rag_token', newToken);
    localStorage.setItem('college_rag_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const loginAsDemoUser = (role: UserRole = 'STUDENT') => {
    const demoUser: User = {
      id: 'demo_user_1',
      name: role === 'ADMIN' ? 'Demo Administrator' : 'Demo Student',
      email: role === 'ADMIN' ? 'admin@demo.college.edu' : 'student@demo.college.edu',
      role: role,
    };
    login('demo_token_xyz', demoUser);
  };


  const logout = () => {
    localStorage.removeItem('college_rag_token');
    localStorage.removeItem('college_rag_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isDemoMode, login, loginAsDemoUser, logout }}>
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

