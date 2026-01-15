import axios from 'axios';

// Base URL for the backend API
// Assuming default FastAPI port is 8000. Adjust if needed.
const API_BASE_URL = 'http://localhost:8000';

const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add Auth Token
client.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
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
