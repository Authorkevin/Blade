import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios'; // Replaced by api instance
import api from '../api'; // Import api instance
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../constants'; // Import constants

// API_URL constant is no longer needed if using api instance with baseURL

const RegisterPage = () => {
    const styles = {
        container: {
            padding: '20px',
            maxWidth: '400px',
            margin: '50px auto',
            fontFamily: 'Arial, sans-serif',
            color: '#e0e0e0',
            backgroundColor: '#121212',
            borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        },
        heading: {
            color: '#bb86fc',
            marginBottom: '25px',
            textAlign: 'center',
        },
        formGroup: {
            marginBottom: '15px'
        },
        input: {
            width: '100%',
            padding: '12px',
            boxSizing: 'border-box',
            border: '1px solid #333',
            borderRadius: '4px',
            backgroundColor: '#1e1e1e',
            color: '#e0e0e0',
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
        disabledButton: {
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
        linkText: {
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '0.9em'
        },
        link: {
            color: '#03dac5',
            textDecoration: 'none',
            fontWeight: 'bold'
        }
    };

    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: '',
        re_password: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false); // Added loading state

    const { email, username, password, re_password } = formData;
    const navigate = useNavigate();

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== re_password) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);

        try {
            // Step 1: Create the user
            await api.post('http://localhost:8000/auth/users/', {
                email,
                username,
                password,
                re_password
            });

            // Step 2: Log in the user to get JWT tokens
            let loginResponse;
            try {
                loginResponse = await api.post('http://localhost:8000/auth/jwt/create/', {
                    email, // Add email
                    username,
                    password
                });
            } catch (loginErr) {
                setLoading(false);
                console.error('Login after registration failed:', loginErr.response ? loginErr.response.data : loginErr.message);
                setError(loginErr.response && loginErr.response.data && loginErr.response.data.detail
                    ? `Registration successful, but login failed: ${loginErr.response.data.detail}`
                    : 'Registration successful, but auto-login failed. Please try logging in manually.');
                return;
            }

            const { access, refresh } = loginResponse.data;
            localStorage.setItem(ACCESS_TOKEN, access);
            localStorage.setItem(REFRESH_TOKEN, refresh);
            // api.defaults.headers.common['Authorization'] will be set by interceptor for subsequent api calls

            // Step 3: Fetch user details
            try {
                const userDetailsResponse = await api.get('http://localhost:8000/auth/users/me/');
                localStorage.setItem('user', JSON.stringify(userDetailsResponse.data));
                if (userDetailsResponse.data.username) {
                    localStorage.setItem('user_username', userDetailsResponse.data.username);
                }
                console.log('User details stored:', userDetailsResponse.data);

                setSuccess('Registration and login successful! Welcome.');
                console.log('Access Token:', access);
                console.log('Refresh Token:', refresh);
                setLoading(false);
                navigate('/');

            } catch (userDetailsError) {
                setLoading(false);
                console.error('Failed to fetch user details after login:', userDetailsError.response ? userDetailsError.response.data : userDetailsError.message);
                setError('Login succeeded but failed to fetch user details. Tokens stored. You might be redirected or try refreshing.');
            }

        } catch (regErr) {
            setLoading(false);
            console.error('Registration failed:', regErr.response ? regErr.response.data : regErr.message);
            let errorMessage = 'Registration failed.';
            if (regErr.response && regErr.response.data) {
                const errors = regErr.response.data;
                if (typeof errors === 'object') {
                    const fieldErrors = [];
                    for (const key in errors) {
                        fieldErrors.push(`${key}: ${Array.isArray(errors[key]) ? errors[key].join(' ') : errors[key]}`);
                    }
                    errorMessage = fieldErrors.join('; ');
                } else if (typeof errors === 'string') {
                    errorMessage = errors;
                }
            }
            setError(errorMessage);
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>Register</h2>
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
                        disabled={loading}
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
                        disabled={loading}
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
                        disabled={loading}
                    />
                </div>
                <div style={styles.formGroup}>
                    <input
                        style={styles.input}
                        type="password"
                        placeholder="Confirm Password"
                        name="re_password"
                        value={re_password}
                        onChange={onChange}
                        minLength="6"
                        required
                        disabled={loading}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    style={loading ? {...styles.button, ...styles.disabledButton} : styles.button}
                >
                    {loading ? 'Registering...' : 'Register'}
                </button>
            </form>
            <p style={styles.linkText}>
                Already have an account? <a href="/login" style={styles.link}>Login.</a>
            </p>
        </div>
    );
};

export default RegisterPage;
