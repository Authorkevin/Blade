import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// Using placeholder icons (simple text/emojis for now)
// In a real app, you'd use an icon library like react-icons or SVGs

const MainLayout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate(); // For logout

    const navItems = [
        { path: '/', label: '🏠', name: 'Home' },
        { path: '/messages', label: '💬', name: 'Messages' },
        // Example: Add a placeholder for a page that lists calls or initiates new video calls
        // { path: '/calls-overview', label: '📞', name: 'Calls' },
        { path: '/profile', label: '👤', name: 'Profile' },
    ];

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
                {navItems.map(item => (
                    <Link
                        key={item.name}
                        to={item.path}
                        style={navLinkStyle(location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)) )}
                        title={item.name} // Accessibility
                    >
                        <span style={navIconStyle}>{item.label}</span>
                        {item.name}
                    </Link>
                ))}
            </nav>
        </div>
    );
};

export default MainLayout;
