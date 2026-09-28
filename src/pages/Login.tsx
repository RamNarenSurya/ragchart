import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, getStoredApiBaseUrl, setCustomApiBaseUrl } from '../services/api';
import { MessageSquare, LogIn, Key, Mail, ShieldAlert, Sparkles, Settings, Check } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(getStoredApiBaseUrl());
  const [savedSettingsMsg, setSavedSettingsMsg] = useState('');

  const { login, loginAsDemoUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      if (res.data.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/chat');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const isConnectionError = !err.response || err.code === 'ERR_NETWORK' || status === 404 || status === 405;

      if (isConnectionError) {
        setError('The login service is not connected to this website yet. Please contact the site administrator or try Demo Mode below.');
      } else if (status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(err.response?.data?.error || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: 'STUDENT' | 'ADMIN') => {
    loginAsDemoUser(role);
    if (role === 'ADMIN') {
      navigate('/admin');
    } else {
      navigate('/chat');
    }
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomApiBaseUrl(apiUrl);
    setSavedSettingsMsg('Backend API URL saved!');
    setError('');
    setTimeout(() => setSavedSettingsMsg(''), 3000);
  };

  return (
    <div className="min-h-screen bg-main flex items-center justify-center p-4">
      <div className="max-w-md w-full saas-card p-8 rounded-2xl shadow-sm border border-subtle">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl hero-gradient mx-auto flex items-center justify-center shadow-md mb-4 text-white">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-heading tracking-tight">College AI Assistant</h1>
          <p className="text-xs text-body mt-1">Sign in to access grounded campus information</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <div className="text-[11px] text-red-500 pl-6">
              If this site is hosted on GitHub Pages static host, click <strong>"Explore Demo Mode"</strong> below to test the assistant immediately!
            </div>
          </div>
        )}

        {savedSettingsMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{savedSettingsMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-heading mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full saas-input pl-10 pr-4 py-2.5 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-heading mb-1.5">Password</label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3.5 top-3.5 text-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full saas-input pl-10 pr-4 py-2.5 rounded-xl text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl btn-primary flex items-center justify-center space-x-2 shadow-sm transition-all disabled:opacity-50 mt-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        {/* Demo Mode Actions */}
        <div className="mt-6 pt-5 border-t border-subtle">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider text-center mb-3 flex items-center justify-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-ai" />
            <span>No backend running? Try Instant Demo</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleDemoLogin('STUDENT')}
              className="py-2.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-xs"
            >
              <span>Student Demo</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('ADMIN')}
              className="py-2.5 px-3 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-xs"
            >
              <span>Admin Demo</span>
            </button>
          </div>
        </div>

        {/* Configure Custom API URL Toggle */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs text-muted hover:text-heading flex items-center justify-center space-x-1 mx-auto transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{showSettings ? 'Hide Backend Settings' : 'Configure Backend API URL'}</span>
          </button>

          {showSettings && (
            <form onSubmit={handleSaveApiUrl} className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2">
              <label className="block text-[11px] font-semibold text-heading">Backend Server URL</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://your-backend.onrender.com/api"
                className="w-full saas-input py-1.5 px-3 text-xs rounded-lg"
              />
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setApiUrl('/api');
                    setCustomApiBaseUrl('');
                    setSavedSettingsMsg('Reset to default base URL');
                  }}
                  className="px-2.5 py-1 text-[11px] text-slate-600 hover:underline"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-primary text-white text-[11px] font-semibold rounded-lg shadow-xs"
                >
                  Save URL
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-body">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};

