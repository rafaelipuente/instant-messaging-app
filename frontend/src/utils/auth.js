import { jwtDecode } from 'jwt-decode';

export const isTokenValid = () => {
    const token = localStorage.getItem('authToken');
    if (!token) return false;

    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000; // Current time in seconds
        return decoded.exp > currentTime; // Token is valid if expiration is in the future
    } catch (error) {
        console.error('Invalid token:', error);
        return false;
    }
};

export const logout = () => {
    localStorage.removeItem('authToken');
};
