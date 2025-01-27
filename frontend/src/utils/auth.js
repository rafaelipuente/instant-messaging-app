/**
 * Logs in a user by sending a request to the backend.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @throws {Error} If the login request fails.
 */

//import { useNavigate } from 'react-router-dom';

export const login = async (email, password, navigate) => {
    try {
        const response = await fetch('http://localhost:5000/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Invalid email or password');
        }

        const data = await response.json();
        localStorage.setItem(
            'authUser',
            JSON.stringify({ name: data.name, email: data.email, token: data.token })
        );

        navigate('/chat'); // Redirect to chat room after login
    } catch (error) {
        console.error('Error logging in:', error.message);
        throw new Error('Unable to connect to the server. Please try again.');
    }
};


/**
 * Registers a new user by sending a request to the backend.
 * @param {string} username - The user's username.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @throws {Error} If the registration request fails.
 */
export const register = async (username, email, password, navigate) => {
    try {
        const response = await fetch('http://localhost:5000/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: username, email, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Registration failed. Please try again.');
        }

        const data = await response.json();
        localStorage.setItem(
            'authUser',
            JSON.stringify({ name: data.name, email: data.email, token: data.token })
        );

        navigate('/chat'); // Redirect to chat room after registration
    } catch (error) {
        console.error('Error registering user:', error.message);
        throw new Error('Unable to connect to the server. Please try again.');
    }
};


/**
 * Logs out the user by removing the token and user details from localStorage.
 */
export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authUser');
};

/**
 * Checks if the token is valid (exists and is not expired).
 * @returns {boolean} True if the token is valid, false otherwise.
 */
export const isTokenValid = () => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        const payload = JSON.parse(atob(token.split('.')[1])); // Decode token payload
        return payload.exp > Date.now() / 1000; // Check if token is expired
    } catch (err) {
        console.error('Error decoding token:', err.message);
        return false;
    }
};
