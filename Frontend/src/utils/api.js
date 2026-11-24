import axios from 'axios';

// Set VITE_API_URL in .env.development / Vercel to override.
// Local dev defaults to the local backend; production builds default to the Render API.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5080/api' : 'https://aparte-s1sb.onrender.com/api');

// SignalR hub lives next to /api (e.g. http://localhost:5080/chathub)
export const HUB_URL = API_BASE_URL.replace(/\/api\/?$/, '') + '/chathub';

const api = axios.create({ baseURL: API_BASE_URL });

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('shortlet_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// An expired/invalid token: clear the session so the UI doesn't keep acting logged in.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('shortlet_token')) {
      localStorage.removeItem('shortlet_token');
      localStorage.removeItem('shortlet_user');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

/** Turns any API error into a readable string (never an object, which would crash a toast). */
export const errorMessage = (error, fallback = 'Something went wrong.') => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data?.message) return data.message;
  if (data?.title) return data.title;
  return fallback;
};

export default api;
