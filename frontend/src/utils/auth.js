import { jwtDecode } from 'jwt-decode';

export const isTokenValid = () => {
    const authUser = JSON.parse(localStorage.getItem('authUser'));
    const token = authUser?.token;
    if (!token) return false;

    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        return decoded.exp > currentTime;
    } catch (error) {
        console.error('Invalid token:', error);
        return false;
    }
};

export const getAuthToken = () => {
    const authUser = JSON.parse(localStorage.getItem('authUser'));
    return authUser || null;
};

export const setAuthToken = (data) => {
    localStorage.setItem('authUser', JSON.stringify(data));
};

export const logout = () => {
    localStorage.removeItem('authUser');
};
