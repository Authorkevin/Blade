import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios'; // Remove axios import
import api from '../api'; // Ensure api import is present and uncommented

const LoginPage = () => {
    const styles = {
        container: {
            padding: '20px',
            maxWidth: '400px', // Adjusted for typical login form width
            margin: '50px auto', // Added top margin for centering on page
            fontFamily: 'Arial, sans-serif',
            color: '#e0e0e0',
            backgroundColor: '#121212',
            borderRadius: '8px', // Added border radius to container
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)' // Added shadow
        },
        heading: {
            color: '#bb86fc',
            marginBottom: '25px',
            textAlign: 'center',
            // borderBottom: '1px solid #333', // Optional for login/register
            // paddingBottom: '10px',
        },
        formGroup: {
            marginBottom: '15px'
        },
        // Labels are not explicitly used in the current Login.jsx, inputs have placeholders.
        // If labels were added, this style would apply:
        label: {
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
            color: '#bb86fc'
        },
        input: {
            width: '100%',
            padding: '12px', // Slightly larger padding for login fields
            boxSizing: 'border-box',
            border: '1px solid #333',
            borderRadius: '4px',
            backgroundColor: '#1e1e1e',
            color: '#e0e0e0',
            // marginTop: '5px' // No explicit labels in current form
        },
        button: {
            padding: '12px 15px',
            backgroundColor: '#bb86fc',
            color: '#121212',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            width: '100%',
            marginTop: '10px'
        },
        disabledButton: { // Not currently used as there's no isLoading state for the button
            backgroundColor: '#555',
            color: '#aaa',
            cursor: 'not-allowed'
        },
        message: {
            padding: '10px',
            margin: '15px 0',
            border: '1px solid transparent',
            borderRadius: '4px',
            textAlign: 'center'
        },
        successMessage: {
            backgroundColor: '#03dac5',
            color: '#121212',
        },
        errorMessage: {
            backgroundColor: '#cf6679',
            color: '#121212',
        },
        linkText: { // For "Don't have an account? Sign up."
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '0.9em'
        },
        link: { // For the actual <a> tag
            color: '#03dac5',
            textDecoration: 'none',
            fontWeight: 'bold'
        }
    };

    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const { email, username, password } = formData;

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            // Djoser endpoint for JWT token creation
            const res = await api.post('http://localhost:8000/auth/jwt/create/', {
                email,
                username,
                password
            });
            localStorage.setItem('access', res.data.access);
            localStorage.setItem('refresh', res.data.refresh);

            // Fetch user details
            try {
                const userDetailsResponse = await api.get('http://localhost:8000/auth/users/me/');
                localStorage.setItem('user', JSON.stringify(userDetailsResponse.data));
                // Store username separately for quick access by AdCenter/other components if needed
                if (userDetailsResponse.data.username) {
                    localStorage.setItem('user_username', userDetailsResponse.data.username);
                }
                console.log('User details stored:', userDetailsResponse.data);

                setSuccess('Login successful! Redirecting...');
                console.log('Access Token:', res.data.access);
                console.log('Refresh Token:', res.data.refresh);
                navigate('/'); // Navigate to home or dashboard

            } catch (userDetailsError) {
                console.error('Failed to fetch user details after login:', userDetailsError.response ? userDetailsError.response.data : userDetailsError.message);
                setError('Login succeeded but failed to fetch user details. Tokens stored.');
                // Potentially still navigate or offer a way to retry fetching user details
            }

        } catch (err) {
            console.error('Login API error:', err.response ? err.response.data : err.message);
            let errorMessage = 'Login failed. Please check your credentials.';
            if (err.response && err.response.data) {
                // Handle Djoser's various error formats
                if (err.response.data.detail) {
                    errorMessage = err.response.data.detail;
                } else if (typeof err.response.data === 'object') {
                    errorMessage = Object.entries(err.response.data)
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : value}`)
                        .join('; ');
                }
            }
            setError(errorMessage);
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>Login</h2>
            {error && <div style={{...styles.message, ...styles.errorMessage}}>{error}</div>}
            {success && <div style={{...styles.message, ...styles.successMessage}}>{success}</div>}
            <form onSubmit={onSubmit}>
                <div style={styles.formGroup}>
                    <input
                        style={styles.input}
                        type="email"
                        placeholder="Email"
                        name="email"
                        value={email}
                        onChange={onChange}
                        required
                    />
                </div>
                <div style={styles.formGroup}>
                    <input
                        style={styles.input}
                        type="text"
                        placeholder="Username"
                        name="username"
                        value={username}
                        onChange={onChange}
                        required
                    />
                </div>
                <div style={styles.formGroup}>
                    <input
                        style={styles.input}
                        type="password"
                        placeholder="Password"
                        name="password"
                        value={password}
                        onChange={onChange}
                        minLength="6"
                        required
                    />
                </div>
                <button type="submit" style={styles.button}>Login</button>
            </form>
            <p style={styles.linkText}>
                Don't have an account? <a href="/register" style={styles.link}>Sign up.</a>
            </p>
        </div>
    );
};

export default LoginPage;
