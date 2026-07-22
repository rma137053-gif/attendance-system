import axios from 'axios';

function getToken(): string | null {
  const ls = localStorage.getItem('token');
  if (ls) return ls;
  const m = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return m ? m[1] : null;
}

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
