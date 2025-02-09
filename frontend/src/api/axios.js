import axios from 'axios';
import { getAuthToken } from '../utils/auth';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:5001/api', // Backend base URL
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to add the auth token to every request
axiosInstance.interceptors.request.use(
    (config) => {
        const token = getAuthToken()?.token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default axiosInstance;
