import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // For logout navigation
import chatService from '../services/chatService';

const ProfileSettings = () => {
    const [stripeAccountId, setStripeAccountId] = useState('');
    const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
    const [currentCallRate, setCurrentCallRate] = useState('0.00'); // Stored as string for display
    const [rateInput, setRateInput] = useState('5.00'); // Input field value

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // New state for profile fields
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');

    const navigate = useNavigate();

    // Placeholder: Fetch full profile data on mount
    useEffect(() => {
        // This is where you would fetch user's profile data from your backend,
        // including their current displayName, bio, Stripe status, and call rate.
        // For example:
        // const fetchProfileData = async () => {
        //     try {
        //         const profile = await userService.getMyProfile(); // Assuming such a service
        //         setDisplayName(profile.display_name || '');
        //         setBio(profile.bio || '');
        //         setStripeAccountId(profile.stripe_account_id || '');
        //         setIsOnboardingComplete(profile.stripe_onboarding_complete || false);
        //         const fetchedRate = profile.call_rate ? parseFloat(profile.call_rate).toFixed(2) : '0.00';
        //         setCurrentCallRate(fetchedRate);
        //         setRateInput(fetchedRate !== '0.00' ? fetchedRate : '5.00');
        //     } catch (err) {
        //         setError("Failed to load your settings.");
        //     }
        // };
        // fetchProfileData();
        console.log("TODO: Fetch full user profile data including Stripe status and call rate in ProfileSettings.");
        // For now, try to get some initial values from localStorage if they exist (e.g., from login)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const userObj = JSON.parse(storedUser);
                setDisplayName(userObj.username || ''); // Or a specific display_name field
            } catch (e) { /* ignore */ }
        }
    }, []);


    const handleConnectStripe = async () => {
        setIsLoading(true);
        setError('');
        setSuccessMessage('');
        try {
            const response = await chatService.simulateStripeConnectOnboarding(rateInput);
            setStripeAccountId(response.stripe_account_id);
            setIsOnboardingComplete(response.stripe_onboarding_complete);
            setCurrentCallRate(parseFloat(response.call_rate).toFixed(2)); // Ensure consistent formatting
            setRateInput(parseFloat(response.call_rate).toFixed(2)); // Update input field as well
            setSuccessMessage(response.message || 'Stripe Connect Onboarding Simulated Successfully!');
        } catch (err) {
            const errorMsg = err.detail || err.message || 'Failed to simulate Stripe onboarding.';
            setError(errorMsg);
            console.error("Stripe Onboarding Simulation Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleProfileSave = () => {
        // TODO: Implement backend call to save displayName and bio
        alert(`Simulated Save: Display Name - ${displayName}, Bio - ${bio}`);
        // Example:
        // userService.updateProfile({ display_name: displayName, bio: bio })
        //   .then(() => setSuccessMessage("Profile updated!"))
        //   .catch(err => setError("Failed to update profile."));
    };

    const handleLogout = () => {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('user');
        // TODO: Call a backend logout endpoint if it exists to invalidate tokens server-side
        navigate('/login');
    };

    // Basic styles for dark theme
    const pageStyle = { padding: '20px', maxWidth: '700px', margin: '0 auto', color: '#e0e0e0' };
    const sectionStyle = { backgroundColor: '#1e1e1e', padding: '25px', borderRadius: '8px', marginBottom: '30px', boxShadow: '0 3px 6px rgba(0,0,0,0.25)' };
    const headingStyle = { color: '#bb86fc', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px', fontSize: '1.8em' };
    const subHeadingStyle = { color: '#bb86fc', marginBottom: '15px', fontSize: '1.4em' };
    const labelStyle = {display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#c0c0c0'};
    const inputStyle = { backgroundColor: '#2c2c2c', color: '#e0e0e0', border: '1px solid #555', borderRadius: '4px', padding: '12px', width: 'calc(100% - 24px)', marginBottom: '15px', fontSize: '1em' };
    const buttonStyle = { padding: '12px 18px', backgroundColor: '#03dac5', color: '#121212', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1em', transition: 'background-color 0.2s ease' };
    const logoutButtonStyle = { ...buttonStyle, backgroundColor: '#cf6679', color: 'white', marginTop: '20px', width: '100%' };
    const infoTextStyle = { color: '#c0c0c0', marginBottom: '8px' };
    const smallTextStyle = { fontSize: '0.9em', color: '#888' };


    return (
        <div style={pageStyle}>
            <h2 style={headingStyle}>Profile & Settings</h2>

            <section style={sectionStyle}>
                <h3 style={subHeadingStyle}>Edit Profile</h3>
                <div>
                    <label htmlFor="displayName" style={labelStyle}>Display Name:</label>
                    <input type="text" id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} placeholder="Your display name" />
                </div>
                <div>
                    <label htmlFor="bio" style={labelStyle}>Bio:</label>
                    <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} style={{...inputStyle, height: '80px', resize: 'vertical'}} placeholder="Tell us about yourself..."></textarea>
                </div>
                <button onClick={handleProfileSave} style={{...buttonStyle, backgroundColor: '#6200ee', color: 'white'}}>Save Profile Changes</button>
            </section>

            <section style={sectionStyle}>
                <h3 style={subHeadingStyle}>Stripe Payments Configuration</h3>
                {isLoading && <p>Processing...</p>}
                {error && <p style={{ color: 'red' }}>Error: {error}</p>}
                {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

                <div>
                    <p style={infoTextStyle}><strong>Status:</strong> {isOnboardingComplete ? `Connected (Account ID: ${stripeAccountId || 'N/A'})` : 'Not Connected'}</p>
                    <p style={infoTextStyle}><strong>Your Current Call Rate:</strong> ${currentCallRate} per session</p>
                </div>
                <hr style={{borderColor: '#333', margin: '20px 0'}}/>
                <h4>{isOnboardingComplete ? 'Update Call Rate (Simulated)' : 'Connect Stripe & Set Call Rate (Simulated)'}</h4>
                <div>
                    <label htmlFor="callRateInput" style={{...labelStyle, marginRight: '10px'}}>
                        {isOnboardingComplete ? 'New Call Rate (USD):' : 'Set Your Call Rate (USD):'}
                    </label>
                    <input
                        type="number"
                        id="callRateInput"
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        placeholder="e.g., 5.00"
                        min="0.50"
                        step="0.01"
                        style={{...inputStyle, width: '120px', marginRight: '10px', display: 'inline-block'}}
                    />
                    <button onClick={handleConnectStripe} disabled={isLoading} style={buttonStyle}>
                        {isLoading ? 'Processing...' : (isOnboardingComplete ? 'Update Rate (Sim.)' : 'Connect & Set Rate (Sim.)')}
                    </button>
                    <p style={smallTextStyle}><small>This is a simulation. Real Stripe onboarding involves redirection to Stripe.</small></p>
                </div>
            </section>

            <button onClick={handleLogout} style={logoutButtonStyle}>Logout</button>
        </div>
    );
};

export default ProfileSettings;
