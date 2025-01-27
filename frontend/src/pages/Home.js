import React from 'react';

const Home = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
            <h1 className="text-4xl font-bold mb-4">Welcome to the Instant Messaging App</h1>
            <p className="text-lg text-gray-400 mb-6">
                Connect with your friends and colleagues instantly. Use the navigation bar to explore features
                such as chat rooms, login, and registration.
            </p>
            <div className="flex gap-4">
                <a
                    href="/register"
                    className="bg-blue-500 px-6 py-2 rounded hover:bg-blue-600 text-white"
                >
                    Register
                </a>
                <a
                    href="/login"
                    className="bg-green-500 px-6 py-2 rounded hover:bg-green-600 text-white"
                >
                    Login
                </a>
            </div>
        </div>
    );
};

export default Home;
