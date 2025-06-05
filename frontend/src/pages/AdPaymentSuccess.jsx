import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function AdPaymentSuccess() {
    const location = useLocation();
    // sessionId from URL is used directly, not stored in state unless for display post-verification
    // const [sessionId, setSessionId] = useState(null);
    const [adId, setAdId] = useState(null); // This will be set from API response primarily
    const [message, setMessage] = useState('Processing payment confirmation...');
    const [isLoading, setIsLoading] = useState(true); // Start with loading true

    // Basic inline styles
    const styles = {
        container: { padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#e0e0e0', backgroundColor: '#121212', minHeight: '100vh' },
        heading: { color: '#4CAF50', marginBottom: '20px' }, // Green for success
        messageText: { marginBottom: '30px', fontSize: '1.1em' }, // Renamed to avoid conflict with message state
        link: {
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#bb86fc',
            color: '#121212',
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold',
            margin: '10px'
        }
    };

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const sId = queryParams.get('session_id');
        // const initialAdId = queryParams.get('ad_id'); // Ad ID from URL can be used for initial context if needed

        const verifyPayment = async () => {
            setIsLoading(true);
            setMessage(''); // Clear initial message

            const token = localStorage.getItem('access_token');
            if (!token) {
                setMessage('Authentication error: You must be logged in to verify payment.');
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/ads/verify-ad-payment/?session_id=${sId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                const data = await response.json();

                if (response.ok) {
                    setAdId(data.ad_id); // Set adId from verified data
                    setMessage(`Payment for Ad ID ${data.ad_id} (${data.ad_title}) successfully verified. Current status: ${data.ad_status}. Stripe Payment ID: ${data.stripe_payment_id || 'N/A'}.`);
                    // Store or use data.ad_details if needed
                } else {
                    let errorMsg = data.error || `Failed to verify payment. Server status: ${response.status}.`;
                    if(data.payment_status) errorMsg += ` Payment status: ${data.payment_status}.`;
                    setMessage(errorMsg);
                }
            } catch (error) {
                console.error("Error verifying payment:", error);
                setMessage(`An error occurred while verifying payment: ${error.message || 'Network error'}`);
            } finally {
                setIsLoading(false);
            }
        };

        if (sId) {
            verifyPayment();
        } else {
            setMessage('Payment session ID not found in URL. Cannot verify payment.');
            setIsLoading(false);
        }
    }, [location]);

    return (
        <div style={styles.container}>
            <h2 style={!isLoading && message.startsWith("Payment for Ad ID") ? styles.heading : {...styles.heading, color: '#F44336'}}>Payment Verification Status</h2>
            {isLoading ? (
                <p style={styles.messageText}>Verifying payment, please wait...</p>
            ) : (
                <p style={styles.messageText}>{message}</p>
            )}
            <Link to="/ad-center" style={styles.link}>Create Another Ad</Link>
            {adId && <Link to={`/my-ads`} style={{...styles.link, backgroundColor: '#03dac5', color: '#121212'}}>View My Ads</Link>}
            <Link to="/" style={styles.link}>Go to Homepage</Link>
        </div>
    );
}

export default AdPaymentSuccess;
