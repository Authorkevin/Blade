import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../constants'; // Import constants

// It's good practice to use constants for API URLs
const API_URL = 'http://localhost:8000'; // Or use import.meta.env.VITE_API_URL if defined

const RegisterPage = () => {
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
            // Djoser endpoint for user registration
            // Note: Djoser's /users/ endpoint might not require re_password directly in the payload
            // if its serializers are configured to handle it from 'password' and a confirmation field.
            // However, sending it often doesn't hurt if the backend serializer expects it.
            // The current Register.jsx sends it, so we'll keep it.
            await axios.post(`${API_URL}/auth/users/`, {
                email,
                username,
                password,
                re_password
            });

            // setSuccess('Registration successful! Please log in.'); // User created, now log them in.
            // setLoading(false); // Stop loading before navigating or if login is manual.

            // Step 2: Log in the user to get JWT tokens
            let loginResponse;
            try {
                loginResponse = await axios.post(`${API_URL}/auth/jwt/create/`, {
                    username: username, // Assuming Djoser uses username for login
                    password: password
                });
            } catch (loginErr) {
                setLoading(false);
                console.error('Login after registration failed:', loginErr.response ? loginErr.response.data : loginErr.message);
                setError(loginErr.response && loginErr.response.data && loginErr.response.data.detail
                    ? `Registration successful, but login failed: ${loginErr.response.data.detail}`
                    : 'Registration successful, but auto-login failed. Please try logging in manually.');
                // At this point, user is registered but not logged in.
                // You might want to navigate to login page or show a message.
                // navigate('/login'); // Optionally redirect to login
                return;
            }

            const { access, refresh } = loginResponse.data;
            localStorage.setItem(ACCESS_TOKEN, access);
            localStorage.setItem(REFRESH_TOKEN, refresh);

            // Step 3: Fetch user details
            try {
                const userDetailsResponse = await axios.get(`${API_URL}/auth/users/me/`, {
                    headers: {
                        'Authorization': `Bearer ${access}`
                    }
                });
                localStorage.setItem('user', JSON.stringify(userDetailsResponse.data));
                console.log('User details stored:', userDetailsResponse.data);

                setSuccess('Registration and login successful! Welcome.');
                console.log('Access Token:', access);
                console.log('Refresh Token:', refresh);
                setLoading(false);
                navigate('/'); // Navigate to home on full success

            } catch (userDetailsError) {
                setLoading(false);
                console.error('Failed to fetch user details after login:', userDetailsError.response ? userDetailsError.response.data : userDetailsError.message);
                // Tokens are stored, but user details aren't.
                // This could be a temporary issue or a permissions problem on /users/me/.
                setError('Login succeeded but failed to fetch user details. Tokens stored. You might be redirected or try refreshing.');
                // Depending on app requirements, might still navigate home or to a "complete profile" page.
                // navigate('/'); // Or handle this state appropriately
            }

        } catch (regErr) {
            setLoading(false);
            console.error('Registration failed:', regErr.response ? regErr.response.data : regErr.message);
            let errorMessage = 'Registration failed.';
            if (regErr.response && regErr.response.data) {
                // Djoser errors are often field-specific or a 'detail' string
                const errors = regErr.response.data;
                if (typeof errors === 'object') {
                    const fieldErrors = [];
                    for (const key in errors) {
                        fieldErrors.push(`${key}: ${errors[key].join ? errors[key].join(', ') : errors[key]}`);
                    }
                    errorMessage = fieldErrors.join(' ');
                } else if (typeof errors === 'string') {
                    errorMessage = errors;
                }
            }
            setError(errorMessage);
        }
    };

    return (
        <div>
            <h2>Register</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {success && <p style={{ color: 'green' }}>{success}</p>}
            <form onSubmit={onSubmit}>
                <div>
                    <input
                        type="email"
                        placeholder="Email"
                        name="email"
                        value={email}
                        onChange={onChange}
                        required
                        disabled={loading}
                    />
                </div>
                <div>
                    <input
                        type="text"
                        placeholder="Username"
                        name="username"
                        value={username}
                        onChange={onChange}
                        required
                        disabled={loading}
                    />
                </div>
                <div>
                    <input
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
                <div>
                    <input
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
                <button type="submit" disabled={loading}>
                    {loading ? 'Registering...' : 'Register'}
                </button>
            </form>
        </div>
    );
};

export default RegisterPage;
