import axios from 'axios';

const api = axios.create({
  baseURL: '/tag/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tag_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tag_token');
      localStorage.removeItem('tag_user');
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  },
);

export default api;
