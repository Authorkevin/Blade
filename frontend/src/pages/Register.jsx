import React, { useState } from 'react';
import axios from 'axios';

const RegisterPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        re_password: '' // Djoser requires password confirmation
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const { email, password, re_password } = formData;

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (password !== re_password) {
            setError('Passwords do not match');
            return;
        }
        try {
            // Assuming backend is running on http://localhost:8000
            // Djoser endpoint for user registration
            const res = await axios.post('http://localhost:8000/auth/users/', {
                email,
                password,
                re_password
            });
            // Djoser might require account activation depending on settings.
            // For now, just log success.
            setSuccess('Registration successful! Please check your email for activation if enabled.');
            console.log(res.data);
        } catch (err) {
            console.error(err.response ? err.response.data : err.message);
            setError(err.response && err.response.data && typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : 'Registration failed.');
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
                <div>
                    <input
                        type="password"
                        placeholder="Confirm Password"
                        name="re_password"
                        value={re_password}
                        onChange={onChange}
                        minLength="6"
                        required
                    />
                </div>
                <button type="submit">Register</button>
            </form>
        </div>
    );
};

export default RegisterPage;
