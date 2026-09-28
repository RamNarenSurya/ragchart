import axios from 'axios';

export const getStoredApiBaseUrl = (): string => {
  const customUrl = localStorage.getItem('college_rag_api_url')?.trim();
  if (customUrl) {
    return customUrl.replace(/\/$/, '');
  }

  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:5000/api';
  }

  return '/api';
};

export const setCustomApiBaseUrl = (url: string) => {
  if (url && url.trim()) {
    localStorage.setItem('college_rag_api_url', url.trim().replace(/\/$/, ''));
  } else {
    localStorage.removeItem('college_rag_api_url');
  }
  api.defaults.baseURL = getStoredApiBaseUrl();
};

export const api = axios.create({
  baseURL: getStoredApiBaseUrl(),
});

// Interceptor to attach JWT token to all requests
api.interceptors.request.use((config) => {
  // Ensure we use the latest baseURL dynamically if modified
  config.baseURL = getStoredApiBaseUrl();
  const token = localStorage.getItem('college_rag_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const loginPath = `${import.meta.env.BASE_URL}login`;
      const registerPath = `${import.meta.env.BASE_URL}register`;
      if (window.location.pathname !== loginPath && window.location.pathname !== registerPath) {
        localStorage.removeItem('college_rag_token');
        localStorage.removeItem('college_rag_user');
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

