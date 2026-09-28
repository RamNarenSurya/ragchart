import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Mail, Key } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 bg-main min-h-screen">
      <div>
        <h1 className="text-2xl font-extrabold text-heading flex items-center space-x-2.5">
          <User className="w-6 h-6 text-primary" />
          <span>User Profile</span>
        </h1>
        <p className="text-body text-xs mt-1">Manage your account details and role permissions.</p>
      </div>

      <div className="saas-card p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl hero-gradient flex items-center justify-center text-white text-xl font-bold shadow-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-heading">{user.name}</h2>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                user.role === 'ADMIN'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              }`}>
                {user.role} ROLE
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 pt-4 border-t border-subtle">
          <div className="flex items-center space-x-3 text-xs">
            <Mail className="w-4 h-4 text-muted" />
            <span className="text-body">Email Address:</span>
            <span className="font-semibold text-heading">{user.email}</span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <Shield className="w-4 h-4 text-muted" />
            <span className="text-body">Account Role:</span>
            <span className="font-semibold text-heading">{user.role}</span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <Key className="w-4 h-4 text-muted" />
            <span className="text-body">User ID:</span>
            <span className="font-mono text-xs text-muted">{user.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
