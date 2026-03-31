import axios from 'axios';

// Base URL for the backend API
// Use '/api' so requests go through Vite Proxy -> backend:8000 (Docker internal)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 3600000, // 60 minutes
});

// Interceptor to add Auth Token
client.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        // Also user_id is often needed in headers or query params depending on API design,
        // but Bearer token is standard.
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);
// Interceptor for 401 errors (e.g. token expired)
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Logout user
            localStorage.removeItem('token');
            localStorage.removeItem('user_id');
            // We can't use useNavigate here as it's not a React component,
            // but we can redirect with window.location
            // Also avoid infinite redirect loop if we are already on login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default client;
