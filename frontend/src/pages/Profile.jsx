import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// Placeholder for fetching user data.
// In a real app, this would come from an API (e.g. /api/auth/users/me/ from Djoser) or decoded JWT.
const getPlaceholderUserData = () => {
    const storedUser = localStorage.getItem('user'); // Assuming user object was stored at login
    if (storedUser) {
        try {
            const userObj = JSON.parse(storedUser);
            return {
                // Djoser's /users/me/ endpoint typically returns username, email, id etc.
                username: userObj.username || userObj.email || 'User',
                email: userObj.email || 'No email provided',
                id: userObj.id || userObj.pk || null
            };
        } catch (e) {
            console.error("Error parsing stored user data for ProfilePage:", e);
        }
    }
    // Fallback if nothing in localStorage or parsing failed
    return { username: 'User', email: 'Please log in', id: null };
};


const ProfilePage = () => {
    const [userData, setUserData] = useState({ username: 'Loading...', email: 'Loading...', id: null });

    useEffect(() => {
        // Simulate fetching user data
        setUserData(getPlaceholderUserData());
        // TODO: Replace with actual API call. Example using Djoser:
        // const fetchUser = async () => {
        //     try {
        //         const response = await someApiService.get('/auth/users/me/');
        //         setUserData(response.data);
        //     } catch (error) {
        //         console.error("Failed to fetch user data:", error);
        //         setUserData({ username: 'Error', email: 'Could not load data' });
        //     }
        // };
        // fetchUser();
    }, []);

    // Basic styles for dark theme
    const pageStyle = {
        padding: '20px',
        fontFamily: 'Arial, sans-serif', // Basic font
    };
    const headingStyle = {
        color: '#bb86fc', // Light purple accent
        marginBottom: '25px',
        borderBottom: '1px solid #333',
        paddingBottom: '10px',
    };
    const sectionStyle = {
        backgroundColor: '#1e1e1e', // Darker card background
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    };
    const infoItemStyle = {
        marginBottom: '12px',
        fontSize: '1.1em',
        color: '#c0c0c0', // Light grey text
    };
    const strongStyle = {
        color: '#e0e0e0', // Slightly brighter for labels
        marginRight: '8px',
    };
    const linkStyle = {
        display: 'inline-block',
        marginTop: '20px',
        padding: '12px 18px',
        backgroundColor: '#03dac5', // Teal accent, common in Material dark themes
        color: '#121212', // Dark text for contrast on button
        textDecoration: 'none',
        borderRadius: '5px',
        fontWeight: 'bold',
        transition: 'background-color 0.2s ease',
    };


    return (
        <div style={pageStyle}>
            <h2 style={headingStyle}>My Profile</h2>

            <section style={sectionStyle}>
                <p style={infoItemStyle}><strong style={strongStyle}>User ID:</strong> {userData.id || 'N/A'}</p>
                <p style={infoItemStyle}><strong style={strongStyle}>Username:</strong> {userData.username}</p>
                <p style={infoItemStyle}><strong style={strongStyle}>Email:</strong> {userData.email}</p>
                {/* Add more profile information here as needed */}
            </section>

            <Link to="/settings" style={linkStyle}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#018786'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#03dac5'}
            >
                Profile Settings & Preferences
            </Link>
        </div>
    );
};

export default ProfilePage;
