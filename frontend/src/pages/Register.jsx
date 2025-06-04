import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const RegisterPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        username:'',
        password: '',
        re_password: '' // Djoser requires password confirmation
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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
        try {
            // Assuming backend is running on http://localhost:8000
            // Djoser endpoint for user registration
            const res = await axios.post('http://localhost:8000/auth/users/', {
                email,
                username,
                password,
                re_password
            });
            localStorage.setItem('access', res.data.access);
            localStorage.setItem('refresh', res.data.refresh);

            // Djoser might require account activation depending on settings.
            // For now, just log success.
            try {
                const accessToken = res.data.access;
                const userDetailsResponse = await axios.get('http://localhost:8000/auth/users/me/', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                localStorage.setItem('user', JSON.stringify(userDetailsResponse.data));
                console.log('User details stored:', userDetailsResponse.data);

                setSuccess('Registration successful! Welcome.');
                console.log(res.data);
                console.log('Access Token:', accessToken);
                console.log('Refresh Token:', res.data.refresh);
                navigate('/');

            } catch (userDetailsError) {
                console.error('Failed to fetch user details after login:', userDetailsError.response ? userDetailsError.response.data : userDetailsError.message);
                // Decide if login should still be considered successful if user details fetch fails
                // For now, let's treat it as a partial success, tokens are stored, but user details aren't.
                setError('Login succeeded but failed to fetch user details. Tokens stored.');
                // navigate('/'); // Or navigate to a page that suggests completing profile setup, or just home.
            }
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
                        type="text"
                        placeholder="Username"
                        name="username"
                        value={username}
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
