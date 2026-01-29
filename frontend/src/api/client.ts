import axios from 'axios';

// Base URL for the backend API
// Use '/api' so requests go through Vite Proxy -> backend:8000 (Docker internal)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add Auth Token
client.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`; // Adjust scheme if backend uses something else
        }
        // Also user_id is often needed in headers or query params depending on API design,
        // but Bearer token is standard.
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default client;
