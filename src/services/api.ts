import axios from 'axios';

const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Interceptor to attach JWT token to all requests
api.interceptors.request.use((config) => {
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
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        localStorage.removeItem('college_rag_token');
        localStorage.removeItem('college_rag_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
