import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios'; // For the logout API call
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../constants'; // Assuming these are defined


// Using placeholder icons (simple text/emojis for now)
// In a real app, you'd use an icon library like react-icons or SVGs

const MainLayout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate(); // For logout
    const isAuthenticated = !!localStorage.getItem(ACCESS_TOKEN);

    const baseNavItems = [ // Renamed to baseNavItems
        { path: '/', label: '🏠', name: 'Home' },
        { path: '/messages', label: '💬', name: 'Messages' },
        // Example: Add a placeholder for a page that lists calls or initiates new video calls
        // { path: '/calls-overview', label: '📞', name: 'Calls' },
        { path: '/profile', label: '👤', name: 'Profile' },
    ];

    const handleLogout = async () => {
        // const refreshToken = localStorage.getItem(REFRESH_TOKEN); // refreshToken not directly used for /auth/token/logout/
        // The /auth/token/logout/ endpoint (TokenDestroyView) uses the access token from Authorization header.
        // api.js interceptor should handle adding the access token.
        // If not using api.js for this call, ensure headers are set if needed, but typically interceptors handle this.
        if (localStorage.getItem(ACCESS_TOKEN)) { // Check if user is authenticated before trying backend logout
            try {
                // Using global axios here. If you have an axios instance in api.js, prefer that.
                // e.g., import api from '../api'; await api.post('/auth/token/logout/');
                await axios.post('http://localhost:8000/auth/token/logout/', {}, {
                    headers: {
                        // Axios interceptor in api.js should add this, but being explicit if global axios is used
                        'Authorization': `Bearer ${localStorage.getItem(ACCESS_TOKEN)}`
                    }
                });
                console.log('Successfully logged out on the backend.');
            } catch (err) {
                console.error('Backend logout failed. Proceeding with client-side cleanup.', err.response ? err.response.data : err.message);
            }
        }

        localStorage.removeItem(ACCESS_TOKEN);
        localStorage.removeItem(REFRESH_TOKEN);
        localStorage.removeItem('user');

        navigate('/login');
    };

    // Add Logout to navItems if authenticated
    let currentNavItems = [...baseNavItems]; // Use baseNavItems
    if (isAuthenticated) {
        currentNavItems.push({ path: '#logout', label: '🚪', name: 'Logout', action: handleLogout });
    }


    // Basic Dark Theme Styles
    const layoutStyle = {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#121212', // Darker background for Material Design dark theme feel
        color: '#e0e0e0',
    };

    const headerStyle = {
        backgroundColor: '#1e1e1e', // Slightly lighter than main background
        color: '#ffffff',
        padding: '15px 20px',
        textAlign: 'center',
        borderBottom: '1px solid #333333',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        // For now, just a placeholder
    };

    const appTitleStyle = {
        margin: 0,
        fontSize: '1.5em',
        fontWeight: 'bold',
    };

    const contentStyle = {
        flexGrow: 1,
        padding: '20px',
        paddingBottom: '80px', // Ensure content doesn't hide behind fixed bottom nav
        overflowY: 'auto',
    };

    const bottomNavStyle = {
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#1e1e1e',
        paddingTop: '8px', // Padding for items
        paddingBottom: '8px',
        borderTop: '1px solid #333333',
        boxShadow: '0 -2px 4px rgba(0,0,0,0.2)',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    };

    const navLinkStyle = (isActive) => ({
        color: isActive ? '#bb86fc' : '#8a8a8e', // Purple for active, muted for inactive (common in dark themes)
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontSize: '12px',
        padding: '5px 10px',
        borderRadius: '4px',
        transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
    });

    const navIconStyle = {
        fontSize: '22px',
        marginBottom: '3px',
    };


    return (
        <div style={layoutStyle}>
            <header style={headerStyle}>
                <h1 style={appTitleStyle}>MyApp</h1> {/* Placeholder title */}
            </header>
            <main style={contentStyle}>
                {children}
            </main>
            <nav style={bottomNavStyle}>
                {currentNavItems.map(item => (
                    item.action ? (
                        <button key={item.name} onClick={item.action} style={{...navLinkStyle(false), background: 'none', border: 'none', cursor: 'pointer', padding: '5px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '12px' }} title={item.name}>
                            <span style={navIconStyle}>{item.label}</span>
                            {item.name}
                        </button>
                    ) : (
                        <Link
                            key={item.name}
                            to={item.path}
                            style={navLinkStyle(location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)) )}
                            title={item.name} // Accessibility
                        >
                            <span style={navIconStyle}>{item.label}</span>
                            {item.name}
                        </Link>
                    )
                ))}
            </nav>
        </div>
    );
};

export default MainLayout;
