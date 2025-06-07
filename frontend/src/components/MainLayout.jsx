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
        { path: '/', label: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 28 L32 8 L56 28"/>
  <path d="M12 26 V54 H26 V38 H38 V54 H52 V26"/>
</svg>
, name: 'Home' },
        { path: '/messages', label: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M32 8
           C47 8, 58 18, 58 32
           C58 46, 47 56, 32 56
           C30 56, 27 55.5, 24 54
           L12 56
           L14 46
           C10 42, 6 37, 6 32
           C6 18, 17 8, 32 8
           Z"/>
</svg>
, name: 'Messages' },
        // Example: Add a placeholder for a page that lists calls or initiates new video calls
        // { path: '/calls-overview', label: '📞', name: 'Calls' },
        { path: '/profile', label: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="37" height="37" fill="none" stroke="#bb86fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="32" cy="20" r="12" />
  <path d="M16 52
           C16 42, 24 36, 32 36
           C40 36, 48 42, 48 52" />
</svg>
, name: 'Profile' },
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
        currentNavItems.push({ path: '#logout', label: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="8" width="44" height="48" rx="2" ry="2"/>
  <path d="M28 10 L40 12 L40 52 L28 54 Z" />
  <circle cx="36" cy="32" r="1.5" fill="#bb86fc" />
</svg>
, name: 'Logout', action: handleLogout });
    }


    // Basic Dark Theme Styles
    const layoutStyle = {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        minWidth: '100vw',
        backgroundColor: '#121212', // Darker background for Material Design dark theme feel
        color: '#e0e0e0',
    };

    const headerStyle = {
        backgroundColor: '#121212', // Slightly lighter than main background
        color: '#ffffff',
        padding: '5px 20px',
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
        padding: '0px',
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
        color: isActive ? '#8666c0' : '#bb86fc', // Purple for active, muted for inactive (common in dark themes)
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
                <a href="/"><img src="logo.svg" style={appTitleStyle} width="55" height="55" alt="Sync logo" /></a>

            </header>
            <main style={contentStyle}>
                {children}
            </main>
            <nav style={bottomNavStyle}>
                {currentNavItems.map(item => (
                    item.action ? (
                        <button key={item.name} onClick={item.action} style={{...navLinkStyle(false), background: 'none', border: 'none', cursor: 'pointer', padding: '5px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '12px', color: '#bb86fc' }} title={item.name}>
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
