import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function AdPaymentCancel() {
    const location = useLocation();
    const [adId, setAdId] = useState(null);

    const styles = {
        container: { padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#e0e0e0', backgroundColor: '#121212', minHeight: '100vh' },
        heading: { color: '#F44336', marginBottom: '20px' },
        messageText: { marginBottom: '30px', fontSize: '1.1em' }, // Renamed
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
        const aId = queryParams.get('ad_id');
        setAdId(aId);
    }, [location]);

    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>Payment Cancelled</h2>
            {adId ? (
                <p style={styles.messageText}>
                    The payment process for Ad ID {adId} was cancelled or failed. Your ad has not been submitted for review.
                    You can try creating your ad again from the Ad Center.
                </p>
            ) : (
                <p style={styles.messageText}>
                    The payment process was cancelled or failed.
                </p>
            )}
            <Link to="/ad-center" style={styles.link}>Return to Ad Center</Link>
            <Link to="/" style={styles.link}>Go to Homepage</Link>
        </div>
    );
}

export default AdPaymentCancel;
