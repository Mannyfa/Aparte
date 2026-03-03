import axios from 'axios';

const api = axios.create({
  // This must match your backend URL exactly!
  baseURL: 'https://aparte-s1sb.onrender.com/api',
});

// This automatically attaches your JWT token to every request!
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('shortlet_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;