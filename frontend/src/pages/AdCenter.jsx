import React, { useState, useEffect } from 'react';

function AdCenter() {
    const [adTitle, setAdTitle] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaType, setMediaType] = useState('');
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
    const [targetUrl, setTargetUrl] = useState('');
    const [adCopy, setAdCopy] = useState('');
    const [buttonText, setButtonText] = useState('learn_more');
    const [keywords, setKeywords] = useState('');
    const [budget, setBudget] = useState('10.00');

    const [isLoading, setIsLoading] = useState(false); // Used for main form submission
    const [isPaymentLoading, setIsPaymentLoading] = useState(false); // For payment button
    const [message, setMessage] = useState({ text: '', type: '' });

    const [createdAdId, setCreatedAdId] = useState(null);
    const [showPaymentButton, setShowPaymentButton] = useState(false);
    const [lastCreatedAdTitle, setLastCreatedAdTitle] = useState('');


    const buttonTextMap = {
        'learn_more': 'Learn More',
        'visit': 'Visit',
        'shop': 'Shop',
        'contact_us': 'Contact Us',
        'sign_up': 'Sign Up',
    };

    useEffect(() => {
        return () => {
            if (mediaPreviewUrl) {
                URL.revokeObjectURL(mediaPreviewUrl);
            }
        };
    }, [mediaPreviewUrl]);

    const resetForm = () => {
        setAdTitle('');
        setMediaFile(null);
        setMediaType('');
        if (mediaPreviewUrl) {
            URL.revokeObjectURL(mediaPreviewUrl);
        }
        setMediaPreviewUrl('');
        if(document.getElementById('mediaFile')) {
            document.getElementById('mediaFile').value = null;
        }
        setTargetUrl('');
        setAdCopy('');
        setButtonText('learn_more');
        setKeywords('');
        setBudget('10.00');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true); // Main form loading
        setMessage({ text: '', type: '' });
        setShowPaymentButton(false);
        setCreatedAdId(null);

        const token = localStorage.getItem('access_token');

        if (!token) {
            setMessage({ text: 'Authentication error. Please log in.', type: 'error' });
            setIsLoading(false);
            return;
        }

        if (!mediaFile) {
            setMessage({ text: 'Please select a media file to upload.', type: 'error' });
            setIsLoading(false);
            return;
        }
         if (!mediaType) {
            setMessage({ text: 'Could not determine media type. Please select a valid image or video file.', type: 'error' });
            setIsLoading(false);
            return;
        }

        if (parseFloat(budget) < 10) {
            setMessage({ text: 'Minimum budget is $10.00.', type: 'error' });
            setIsLoading(false);
            return;
        }

        const formData = new FormData();
        formData.append('ad_title', adTitle);
        formData.append('media_file', mediaFile);
        formData.append('media_type', mediaType);
        formData.append('target_url', targetUrl);
        formData.append('ad_copy', adCopy);
        formData.append('button_text', buttonText);
        formData.append('keywords', keywords);
        formData.append('budget', budget);

        try {
            const response = await fetch('/api/ads/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            setIsLoading(false);
            let responseData;
            try {
                responseData = await response.json();
            } catch (jsonError) {
                console.error("Error parsing JSON response:", jsonError);
                if (!response.ok) {
                    setMessage({ text: `Failed to create ad. Server returned status ${response.status}. Could not parse error details.`, type: 'error' });
                } else {
                    setMessage({ text: `Ad created, but server response was not valid JSON. Status: ${response.status}.`, type: 'error' });
                }
                return;
            }

            if (response.ok) {
                setMessage({ text: 'Ad created successfully! Please proceed to payment.', type: 'success' });
                setCreatedAdId(responseData.id);
                setLastCreatedAdTitle(adTitle);
                setShowPaymentButton(true);
                resetForm();
            } else {
                let errorText = `Failed to create ad. Status: ${response.status}`;
                if (responseData && typeof responseData === 'object') {
                    const errors = Object.entries(responseData)
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                        .join('; ');
                    if (errors) errorText += ` Details: ${errors}`;
                }
                setMessage({ text: errorText, type: 'error' });
            }
        } catch (error) {
            setIsLoading(false);
            console.error('Error submitting ad:', error);
            setMessage({ text: `An error occurred: ${error.message || 'Network error or invalid JSON response'}`, type: 'error' });
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];

        if (mediaPreviewUrl) {
            URL.revokeObjectURL(mediaPreviewUrl);
            setMediaPreviewUrl('');
        }

        if (file) {
            setMediaFile(file);
            if (file.type.startsWith('image/')) {
                setMediaType('image');
                setMediaPreviewUrl(URL.createObjectURL(file));
                 setMessage({ text: '', type: '' });
            } else if (file.type.startsWith('video/')) {
                setMediaType('video');
                 setMessage({ text: '', type: '' });
            } else {
                setMediaType('');
                setMessage({text: "Unsupported file type. Please select an image or video.", type: 'error'});
            }
        } else {
            setMediaFile(null);
            setMediaType('');
        }
    };

    const handleProceedToPayment = async (adId) => {
        if (!adId) {
            setMessage({ text: 'No Ad ID specified for payment.', type: 'error' });
            return;
        }
        setIsPaymentLoading(true);
        setMessage({ text: '', type: '' }); // Clear previous messages

        const token = localStorage.getItem('access_token');
        if (!token) {
            setMessage({ text: 'Authentication error. Please log in.', type: 'error' });
            setIsPaymentLoading(false);
            return;
        }

        try {
            const response = await fetch(`/api/ads/${adId}/create-checkout-session/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json', // Explicitly set though not strictly needed for empty body POSTs by some servers
                },
                // No body needed for this POST request as adId is in URL
            });

            const responseData = await response.json();

            if (response.ok) {
                const { sessionId, publishableKey } = responseData;
                if (!publishableKey) {
                    setMessage({ text: 'Stripe publishable key not provided by server.', type: 'error' });
                    setIsPaymentLoading(false);
                    return;
                }
                if (!sessionId) {
                    setMessage({ text: 'Stripe session ID not provided by server.', type: 'error' });
                    setIsPaymentLoading(false);
                    return;
                }

                const stripe = window.Stripe(publishableKey);
                if (!stripe) {
                     setMessage({ text: 'Stripe.js not loaded correctly.', type: 'error' });
                     setIsPaymentLoading(false);
                     return;
                }
                const { error } = await stripe.redirectToCheckout({ sessionId });

                if (error) {
                    console.error("Stripe redirectToCheckout error:", error);
                    setMessage({ text: `Failed to redirect to Stripe: ${error.message}`, type: 'error' });
                    setIsPaymentLoading(false); // Only set if redirection itself fails before navigating away
                }
                // If redirectToCheckout is successful, the user is navigated away, so no need to set loading to false here.
            } else {
                let errorText = `Failed to create payment session. Status: ${response.status}`;
                if (responseData && typeof responseData === 'object') {
                    const errors = Object.entries(responseData)
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                        .join('; ');
                    if (errors) errorText += ` Details: ${errors}`;
                }
                setMessage({ text: errorText, type: 'error' });
                setIsPaymentLoading(false);
            }
        } catch (error) {
            console.error('Error creating payment session:', error);
            setMessage({ text: `An error occurred: ${error.message || 'Network error or invalid JSON response'}`, type: 'error' });
            setIsPaymentLoading(false);
        }
    };

    const styles = {
        container: { padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial, sans-serif', color: '#e0e0e0', backgroundColor: '#121212' },
        formGroup: { marginBottom: '15px' },
        label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#bb86fc' },
        input: { width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #333', borderRadius: '4px', backgroundColor: '#1e1e1e', color: '#e0e0e0' },
        textarea: { width: '100%', padding: '10px', boxSizing: 'border-box', minHeight: '100px', border: '1px solid #333', borderRadius: '4px', backgroundColor: '#1e1e1e', color: '#e0e0e0' },
        select: { width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #333', borderRadius: '4px', backgroundColor: '#1e1e1e', color: '#e0e0e0' },
        button: { padding: '10px 15px', backgroundColor: '#bb86fc', color: '#121212', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
        message: { padding: '10px', margin: '15px 0', border: '1px solid transparent', borderRadius: '4px' },
        successMessage: { backgroundColor: '#03dac5', color: '#121212', borderColor: '#03dac5' },
        errorMessage: { backgroundColor: '#cf6679', color: '#121212', borderColor: '#cf6679' },
        mockupContainer: { marginTop: '30px', padding: '20px', border: '1px solid #444', borderRadius: '8px', backgroundColor: '#2e2e2e', color: '#f0f0f0' },
        mockupAdTitle: { fontSize: '1.2em', fontWeight: 'bold', color: '#bb86fc', marginBottom: '10px', textAlign: 'center' },
        mockupMediaArea: { width: '100%', height: '180px', backgroundColor: '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', borderRadius: '4px', overflow: 'hidden' },
        mockupImage: { maxWidth: '100%', maxHeight: '100%', display: 'block', borderRadius: '4px' },
        mockupSponsoredLine: { fontSize: '0.9em', color: '#aaa', marginBottom: '8px', textAlign: 'center' },
        mockupAdCopy: { fontSize: '1em', marginBottom: '15px', padding: '10px', border: '1px dashed #555', borderRadius: '4px', minHeight: '50px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', backgroundColor: '#333' },
        mockupButton: { padding: '10px 15px', backgroundColor: '#bb86fc', color: '#121212', border: 'none', borderRadius: '5px', cursor: 'default', fontWeight: 'bold', display: 'block', margin: '0 auto' },
        paymentSection: { marginTop: '20px', padding: '20px', border: '1px solid #03dac5', borderRadius: '8px', backgroundColor: '#2a2a2a', textAlign: 'center' }
    };

    return (
        <div style={styles.container}>
            <h2>Create Your Ad</h2>

            {message.text && ( // General messages shown here
                <div style={{
                    ...styles.message,
                    ...(message.type === 'success' && !showPaymentButton ? styles.successMessage : {}), // Only general success if not payment stage
                    ...(message.type === 'error' ? styles.errorMessage : {})
                }}>
                    {message.text}
                </div>
            )}

            {!showPaymentButton ? (
                <form onSubmit={handleSubmit}>
                    {/* Form groups... */}
                    <div style={styles.formGroup}>
                        <label htmlFor="adTitle" style={styles.label}>Ad Title:</label>
                        <input type="text" id="adTitle" style={styles.input} value={adTitle} onChange={(e) => setAdTitle(e.target.value)} required disabled={isLoading} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="mediaFile" style={styles.label}>Media (Image or Video):</label>
                        <input type="file" id="mediaFile" style={styles.input} accept="image/*,video/*" onChange={handleFileChange} required disabled={isLoading} />
                        {mediaFile && !mediaPreviewUrl && mediaType === 'video' && <p style={{fontSize: '0.9em', color: '#aaa'}}>Video selected: {mediaFile.name}</p>}
                        {mediaFile && !mediaPreviewUrl && mediaType !== 'video' && mediaType !== 'image' && <p style={{fontSize: '0.9em', color: '#aaa'}}>File: {mediaFile.name}</p>}
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="targetUrl" style={styles.label}>Target URL:</label>
                        <input type="url" id="targetUrl" style={styles.input} value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://example.com" required disabled={isLoading} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="adCopy" style={styles.label}>Ad Copy:</label>
                        <textarea id="adCopy" style={styles.textarea} value={adCopy} onChange={(e) => setAdCopy(e.target.value)} required disabled={isLoading} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="buttonText" style={styles.label}>Button Text:</label>
                        <select id="buttonText" style={styles.select} value={buttonText} onChange={(e) => setButtonText(e.target.value)} disabled={isLoading}>
                            <option value="learn_more">Learn More</option>
                            <option value="visit">Visit</option>
                            <option value="shop">Shop</option>
                            <option value="contact_us">Contact Us</option>
                            <option value="sign_up">Sign Up</option>
                        </select>
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="keywords" style={styles.label}>Keywords (comma-separated):</label>
                        <input type="text" id="keywords" style={styles.input} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g., travel, food, gaming" disabled={isLoading} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="budget" style={styles.label}>Budget (Minimum $10.00):</label>
                        <input type="number" id="budget" style={styles.input} value={budget} onChange={(e) => setBudget(e.target.value)} min="10.00" step="0.01" required disabled={isLoading} />
                    </div>
                    <button type="submit" style={styles.button} disabled={isLoading}>
                        {isLoading ? 'Saving Ad...' : 'Save Ad & Preview Payment'}
                    </button>
                </form>
            ) : (
                <div style={styles.paymentSection}>
                    <h3 style={{color: '#03dac5', marginBottom: '15px'}}>{message.text}</h3>
                    <p style={{color: '#e0e0e0', marginBottom: '10px'}}>Ad Title: "{lastCreatedAdTitle}"</p>
                    <p style={{color: '#e0e0e0', marginBottom: '20px'}}>Ad ID: {createdAdId}</p>
                    <button
                        onClick={() => handleProceedToPayment(createdAdId)}
                        style={{ ...styles.button, backgroundColor: '#03dac5', color: '#121212' }}
                        disabled={isPaymentLoading}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = isPaymentLoading? '' : '#018786'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = isPaymentLoading? '' : '#03dac5'}
                    >
                        {isPaymentLoading ? 'Processing...' : `Proceed to Payment for Ad #${createdAdId}`}
                    </button>
                     <button
                        onClick={() => {
                           setShowPaymentButton(false);
                           setMessage({text: '', type: ''});
                        }}
                        style={{ ...styles.button, backgroundColor: '#555', color: '#fff', marginLeft: '10px', marginTop: '10px' }}
                        disabled={isPaymentLoading}
                         onMouseOver={(e) => e.currentTarget.style.backgroundColor = isPaymentLoading? '' : '#777'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = isPaymentLoading? '' : '#555'}
                    >
                        Create Another Ad
                    </button>
                </div>
            )}

            {!showPaymentButton && (
                <div style={styles.mockupContainer}>
                    {/* Mockup content... */}
                    <h4 style={{textAlign: 'center', color: '#e0e0e0', marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '10px'}}>Ad Preview</h4>
                    {adTitle && <div style={styles.mockupAdTitle}>{adTitle}</div>}
                    <div style={styles.mockupMediaArea}>
                        {mediaType === 'image' && mediaPreviewUrl ? (
                            <img src={mediaPreviewUrl} alt="Ad media preview" style={styles.mockupImage} />
                        ) : mediaType === 'video' && mediaFile ? (
                            <p style={{color: '#ccc', textAlign:'center'}}>Video Selected: <br/><em>{mediaFile.name}</em></p>
                        ) : (
                            <p style={{color: '#ccc', textAlign:'center'}}>Your media will appear here</p>
                        )}
                    </div>
                    <p style={styles.mockupSponsoredLine}>Sponsored by @YourUsername</p>
                    <div style={styles.mockupAdCopy}>{adCopy || "Your ad copy will appear here..."}</div>
                    <button style={styles.mockupButton} type="button">
                        {buttonTextMap[buttonText] || 'Button Text'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default AdCenter;
