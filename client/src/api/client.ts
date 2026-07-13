import axios from 'axios';

// Detect if running inside Capacitor (native app) vs browser
const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

// In native APK, use absolute server URL; in browser, use relative path
const baseURL = isCapacitor
  ? 'http://192.168.0.118:3000/api' // TODO: change to your server IP
  : '/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;
