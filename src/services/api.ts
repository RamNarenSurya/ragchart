import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
