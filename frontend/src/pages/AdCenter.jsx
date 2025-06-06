import React, { useState, useEffect } from 'react';
import api from '../api'; // Import api instance

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

    // New state variables for targeting
    const [targetAgeMin, setTargetAgeMin] = useState(''); // Or 18
    const [targetAgeMax, setTargetAgeMax] = useState(''); // Or 65
    const [targetGender, setTargetGender] = useState('any');
    const [targetDevice, setTargetDevice] = useState('any');
    const [targetTimeOfDayStart, setTargetTimeOfDayStart] = useState('');
    const [targetTimeOfDayEnd, setTargetTimeOfDayEnd] = useState('');
    const [targetRegion, setTargetRegion] = useState('');
    const [creatorUsername, setCreatorUsername] = useState('');

    // State for budget estimates
    const [estimates, setEstimates] = useState({ impressions_estimate: 0, ctr_benchmark_percentage: 0, estimated_clicks: 0, cost_per_action_avg: 'N/A' });
    const [isEstimating, setIsEstimating] = useState(false);

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

    useEffect(() => {
        const storedUserJSON = localStorage.getItem('user'); // Attempt to get the 'user' object string
        if (storedUserJSON) {
            try {
                const userObj = JSON.parse(storedUserJSON);
                if (userObj && userObj.username) {
                    setCreatorUsername(userObj.username);
                } else {
                    // Fallback or specific handling if username isn't in the object
                    console.warn("AdCenter: Username not found in stored user object in localStorage.");
                    // Optionally, try 'user_username' as a fallback if the structure is uncertain
                    // const fallbackUsername = localStorage.getItem('user_username');
                    // if (fallbackUsername) setCreatorUsername(fallbackUsername);
                }
            } catch (e) {
                console.error("AdCenter: Error parsing stored user data from localStorage:", e);
            }
        } else {
            console.warn("AdCenter: No 'user' data found in localStorage for creator username.");
            // Optionally, try 'user_username' as a fallback
            // const fallbackUsername = localStorage.getItem('user_username');
            // if (fallbackUsername) setCreatorUsername(fallbackUsername);
        }
    }, []); // Empty dependency array ensures this runs once on mount

    const fetchEstimates = async (currentBudget) => {
        if (!currentBudget || parseFloat(currentBudget) < 10) {
            setEstimates({ impressions_estimate: 0, ctr_benchmark_percentage: 0, estimated_clicks: 0, cost_per_action_avg: 'N/A' });
            return;
        }
        setIsEstimating(true);
        setMessage({ text: '', type: '' }); // Clear general messages
        // Token handling is removed, api instance will use interceptor

        try {
            const response = await api.post('/ads/estimate-budget/', {
                budget: parseFloat(currentBudget)
            });
            // Axios response data is directly in response.data
            setEstimates(response.data);
        } catch (error) {
            console.error('Error fetching budget estimates:', error);
            if (error.response && error.response.data && error.response.data.error) {
                setMessage({ text: error.response.data.error, type: 'error' });
            } else if (error.request) {
                setMessage({ text: 'No response from server. Check network.', type: 'error' });
            } else {
                setMessage({ text: 'Error setting up request for budget estimates.', type: 'error' });
            }
            setEstimates({ impressions_estimate: 0, ctr_benchmark_percentage: 0, estimated_clicks: 0, cost_per_action_avg: 'N/A' });
        } finally {
            setIsEstimating(false);
        }
    };

    useEffect(() => {
        const budgetValue = parseFloat(budget);
        if (budgetValue >= 10) {
            const timer = setTimeout(() => { // Simple debounce
                fetchEstimates(budget);
            }, 500); // Debounce time in ms
            return () => clearTimeout(timer);
        } else {
            setEstimates({ impressions_estimate: 0, ctr_benchmark_percentage: 0, estimated_clicks: 0, cost_per_action_avg: 'N/A' });
        }
    }, [budget]);

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
        // Reset new targeting fields
        setTargetAgeMin('');
        setTargetAgeMax('');
        setTargetGender('any');
        setTargetDevice('any');
        setTargetTimeOfDayStart('');
        setTargetTimeOfDayEnd('');
        setTargetRegion('');
        setEstimates({ impressions_estimate: 0, ctr_benchmark_percentage: 0, estimated_clicks: 0, cost_per_action_avg: 'N/A' }); // Reset estimates
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true); // Main form loading
        setMessage({ text: '', type: '' });
        setShowPaymentButton(false);
        setCreatedAdId(null);

        // Token handling is removed

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

        // Append new targeting fields if they have values
        if (targetAgeMin) formData.append('target_age_min', targetAgeMin);
        if (targetAgeMax) formData.append('target_age_max', targetAgeMax);
        formData.append('target_gender', targetGender);
        formData.append('target_device', targetDevice);
        if (targetTimeOfDayStart) formData.append('target_time_of_day_start', targetTimeOfDayStart);
        if (targetTimeOfDayEnd) formData.append('target_time_of_day_end', targetTimeOfDayEnd);
        if (targetRegion) formData.append('target_region', targetRegion);

        try {
            // Use api.post for FormData; Axios handles Content-Type for FormData automatically.
            // No need to set Authorization header, interceptor does it.
            const response = await api.post('/ads/', formData);

            setIsLoading(false);
            // Axios response data is in response.data
            const responseData = response.data;

            // Axios considers non-2xx responses as errors, so they'll be caught by the catch block.
            // This 'if (response.ok)' or checking status code here is for fetch.
            // For Axios, a successful request (2xx) will land here.
            setMessage({ text: 'Ad created successfully! Please proceed to payment.', type: 'success' });
            setCreatedAdId(responseData.id);
            setLastCreatedAdTitle(adTitle);
            setShowPaymentButton(true);
            resetForm();

        } catch (error) {
            setIsLoading(false);
            console.error('Error submitting ad:', error);
            let errorText = 'Failed to create ad.';
            if (error.response && error.response.data) {
                // Assuming error.response.data is an object like { field: ["message"], ... } or { detail: "message" }
                const errors = Object.entries(error.response.data)
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                    .join('; ');
                if (errors) errorText += ` Details: ${errors}`;
                else if (typeof error.response.data === 'string') errorText += ` Details: ${error.response.data}`;
            } else if (error.request) {
                errorText = 'No response from server. Check network.';
            } else {
                errorText = `An error occurred: ${error.message || 'Unknown error'}`;
            }
            setMessage({ text: errorText, type: 'error' });
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
        // Token handling removed

        try {
            // Use api.post for the request. Axios handles Content-Type for JSON by default.
            // No body needed for this POST request to this specific endpoint.
            const response = await api.post(`/ads/${adId}/create-checkout-session/`);

            // Axios response data is in response.data
            const responseData = response.data;

            // Successful 2xx response from Axios
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
            const { error: stripeError } = await stripe.redirectToCheckout({ sessionId }); // Renamed error to stripeError

            if (stripeError) {
                console.error("Stripe redirectToCheckout error:", stripeError);
                setMessage({ text: `Failed to redirect to Stripe: ${stripeError.message}`, type: 'error' });
                setIsPaymentLoading(false);
            }
            // If redirectToCheckout is successful, the user is navigated away.
        } catch (error) {
            console.error('Error creating payment session:', error);
            let errorText = 'Failed to create payment session.';
            if (error.response && error.response.data) {
                const errors = Object.entries(error.response.data)
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                    .join('; ');
                if (errors) errorText += ` Details: ${errors}`;
                 else if (typeof error.response.data === 'string') errorText += ` Details: ${error.response.data}`;
            } else if (error.request) {
                errorText = 'No response from server. Check network.';
            } else {
                errorText = `An error occurred: ${error.message || 'Unknown error'}`;
            }
            setMessage({ text: errorText, type: 'error' });
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
                        <input
                            type="number"
                            id="budgetNumber"
                            style={styles.input}
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            min="10.00"
                            step="0.01"
                            required
                            disabled={isLoading}
                        />
                        <input
                            type="range"
                            id="budgetSlider"
                            style={{width: '100%', marginTop: '10px'}}
                            value={parseFloat(budget) || 10} // Ensure value is a number for the slider
                            onChange={(e) => setBudget(e.target.value)}
                            min="10"
                            max="1000" // Adjust max as needed
                            step="1"
                            disabled={isLoading}
                        />
                    </div>

                    {isEstimating && <p style={{color: '#03dac5', textAlign: 'center'}}>Calculating estimates...</p>}
                    {estimates && !isEstimating && parseFloat(budget) >= 10 && (
                        <div style={{...styles.formGroup, padding: '10px', border: '1px solid #333', borderRadius: '4px', backgroundColor: '#1e1e1e'}}>
                            <h4 style={{color: '#bb86fc', marginBottom: '10px', textAlign: 'center'}}>Estimated Reach</h4>
                            <p style={{color: '#e0e0e0', marginBottom: '5px'}}>Estimated Impressions: {estimates.impressions_estimate !== undefined ? estimates.impressions_estimate.toLocaleString() : 'N/A'}</p>
                            <p style={{color: '#e0e0e0', marginBottom: '5px'}}>Estimated Clicks: {estimates.estimated_clicks !== undefined ? estimates.estimated_clicks.toLocaleString() : 'N/A'}</p>
                            <p style={{color: '#e0e0e0', marginBottom: '5px'}}>CTR Benchmark: {estimates.ctr_benchmark_percentage !== undefined ? estimates.ctr_benchmark_percentage : 'N/A'}%</p>
                            <p style={{color: '#e0e0e0'}}>Avg. Cost Per Action (Click): ${estimates.cost_per_action_avg !== undefined ? estimates.cost_per_action_avg : 'N/A'}</p>
                        </div>
                    )}

                    {/* New Targeting Fields */}
                    <h3 style={{ color: '#bb86fc', marginTop: '30px', marginBottom: '10px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>Targeting Options</h3>

                    <div style={styles.formGroup}>
                        <label htmlFor="targetAgeMin" style={styles.label}>Target Minimum Age:</label>
                        <input type="number" id="targetAgeMin" style={styles.input} value={targetAgeMin} onChange={(e) => setTargetAgeMin(e.target.value)} placeholder="e.g., 18" disabled={isLoading} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="targetAgeMax" style={styles.label}>Target Maximum Age:</label>
                        <input type="number" id="targetAgeMax" style={styles.input} value={targetAgeMax} onChange={(e) => setTargetAgeMax(e.target.value)} placeholder="e.g., 65" disabled={isLoading} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="targetGender" style={styles.label}>Target Gender:</label>
                        <select id="targetGender" style={styles.select} value={targetGender} onChange={(e) => setTargetGender(e.target.value)} disabled={isLoading}>
                            <option value="any">Any Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="non_binary">Non-binary</option>
                        </select>
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="targetDevice" style={styles.label}>Target Device:</label>
                        <select id="targetDevice" style={styles.select} value={targetDevice} onChange={(e) => setTargetDevice(e.target.value)} disabled={isLoading}>
                            <option value="any">Any Device</option>
                            <option value="mobile">Mobile</option>
                            <option value="desktop">Desktop</option>
                        </select>
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="targetTimeOfDayStart" style={styles.label}>Targeting Start Date/Time:</label>
                        <input type="datetime-local" id="targetTimeOfDayStart" style={styles.input} value={targetTimeOfDayStart} onChange={(e) => setTargetTimeOfDayStart(e.target.value)} disabled={isLoading} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="targetTimeOfDayEnd" style={styles.label}>Targeting End Date/Time:</label>
                        <input type="datetime-local" id="targetTimeOfDayEnd" style={styles.input} value={targetTimeOfDayEnd} onChange={(e) => setTargetTimeOfDayEnd(e.target.value)} disabled={isLoading} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="targetRegion" style={styles.label}>Target Region (e.g., City, Country):</label>
                        <input type="text" id="targetRegion" style={styles.input} value={targetRegion} onChange={(e) => setTargetRegion(e.target.value)} placeholder="e.g., New York, USA" disabled={isLoading} />
                    </div>

                    <button type="submit" style={{...styles.button, marginTop: '20px'}} disabled={isLoading}>
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
                    <p style={styles.mockupSponsoredLine}>Sponsored by @{creatorUsername || 'YourUsername'}</p>
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
