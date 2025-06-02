import React, { useState } from 'react';
import axios from 'axios';

const LoginPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const { email, password } = formData;

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            // Assuming backend is running on http://localhost:8000
            // Djoser endpoint for JWT token creation
            const res = await axios.post('http://localhost:8000/auth/jwt/create/', {
                email,
                password
            });
            localStorage.setItem('access', res.data.access);
            localStorage.setItem('refresh', res.data.refresh);
            // You might want to redirect the user or update UI state here
            setSuccess('Login successful! Token stored.');
            console.log('Access Token:', res.data.access);
            console.log('Refresh Token:', res.data.refresh);
        } catch (err) {
            console.error(err.response ? err.response.data : err.message);
            setError(err.response && err.response.data && typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : 'Login failed. Please check your credentials.');
        }
    };

    return (
        <div>
            <h2>Login</h2>
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
                    />
                </div>
                <div>
                    <input
                        type="password"
                        placeholder="Password"
                        name="password"
                        value={password}
                        onChange={onChange}
                        minLength="6" // Adjust as per your backend validation
                        required
                    />
                </div>
                <button type="submit">Login</button>
            </form>
        </div>
    );
};

export default LoginPage;
