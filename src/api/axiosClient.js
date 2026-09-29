import axios from 'axios';

const API_BASE_URL = 'https://bcknd.smartego.org/api';

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: attach bearer token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smartego_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 unauthorized & uniform error responses
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't clear token if the 401 was during the login attempt itself
      const isLoginEndpoint = error.config?.url?.includes('/auth/admin/login');
      if (!isLoginEndpoint) {
        localStorage.removeItem('smartego_token');
        localStorage.removeItem('smartego_user');
        window.dispatchEvent(new CustomEvent('smartego:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
