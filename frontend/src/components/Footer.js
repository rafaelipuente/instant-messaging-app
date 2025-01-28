import React from 'react';

const Footer = () => {
    return (
        <footer className="bg-gray-900 text-white text-center py-4 mt-10">
            <p className="text-sm">&copy; {new Date().getFullYear()} Instant Messaging App. All rights reserved.</p>
            <p className="text-xs">Built with love by Rafael</p>
        </footer>
    );
};

export default Footer;
