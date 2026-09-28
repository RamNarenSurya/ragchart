import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Shield, LogOut, History } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-surface sticky top-0 z-50 px-6 py-3 border-b border-subtle shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/chat" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl hero-gradient flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight text-heading">
              College AI Assistant
            </div>
            <div className="text-[11px] text-ai font-semibold">RAG Grounded Knowledge Base</div>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center space-x-2">
          <Link
            to="/chat"
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              isActive('/chat')
                ? 'bg-indigo-50 text-primary border border-indigo-200'
                : 'text-body hover:text-heading hover:bg-slate-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat</span>
          </Link>

          <Link
            to="/history"
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              isActive('/history')
                ? 'bg-indigo-50 text-primary border border-indigo-200'
                : 'text-body hover:text-heading hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </Link>

          {user.role === 'ADMIN' && (
            <>
              <Link
                to="/admin"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  location.pathname === '/admin'
                    ? 'bg-purple-50 text-secondary border border-purple-200'
                    : 'text-body hover:text-heading hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4 text-secondary" />
                <span>Admin Dashboard</span>
              </Link>

              <Link
                to="/admin/logs"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive('/admin/logs')
                    ? 'bg-purple-50 text-secondary border border-purple-200'
                    : 'text-body hover:text-heading hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4 text-secondary" />
                <span>Audit Logs</span>
              </Link>
            </>
          )}
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-subtle">
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-primary flex items-center justify-center text-xs font-bold border border-indigo-200">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-heading">{user.name}</div>
              <div className="flex items-center space-x-1">
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                  user.role === 'ADMIN'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            className="p-2 rounded-lg bg-surface hover:bg-red-50 text-slate-400 hover:text-red-600 border border-subtle hover:border-red-200 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
};
