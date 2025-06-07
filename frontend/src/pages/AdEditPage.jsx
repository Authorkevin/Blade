import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adService from '../services/adService';

// Assume similar styles to AdCenter.jsx or define new ones
const styles = {
    container: {
        padding: '20px',
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: '#1e1e1e', // Dark theme container background
        color: '#fff',
        borderRadius: '8px',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
    },
    label: {
        marginBottom: '5px',
        fontSize: '0.9em',
        color: '#aaa',
    },
    input: {
        padding: '10px',
        borderRadius: '4px',
        border: '1px solid #555',
        backgroundColor: '#333',
        color: '#fff',
        fontSize: '1em',
    },
    textarea: {
        padding: '10px',
        borderRadius: '4px',
        border: '1px solid #555',
        backgroundColor: '#333',
        color: '#fff',
        fontSize: '1em',
        minHeight: '80px',
        resize: 'vertical',
    },
    button: {
        padding: '10px 15px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: '#bb86fc', // Primary button color (purple)
        color: '#000',
        cursor: 'pointer',
        fontSize: '1em',
        fontWeight: 'bold',
        marginTop: '10px',
    },
    cancelButton: {
        backgroundColor: '#444', // Secondary/cancel button color
        color: '#fff',
    },
    message: {
        padding: '10px',
        borderRadius: '4px',
        marginBottom: '15px',
        textAlign: 'center',
    },
    successMessage: {
        backgroundColor: '#03dac5', // Teal for success
        color: '#000',
    },
    errorMessage: {
        backgroundColor: '#cf6679', // Red for error
        color: '#000',
    },
    loading: {
        textAlign: 'center',
        fontSize: '1.2em',
        color: '#aaa',
    }
};

const AdEditPage = () => {
    const { adId } = useParams();
    const navigate = useNavigate();
    const isCreating = !adId;

    const [adData, setAdData] = useState({
        ad_title: '',
        target_url: '',
        ad_copy: '',
        keywords: '',
        budget: '',
        target_age_min: '',
        target_age_max: '',
        target_gender: 'any',
        target_locations: '',
        media_type: 'image', // Default media type
        media_file: null,
        button_text: 'learn_more', // Default button text
    });
    const [originalAdData, setOriginalAdData] = useState({}); // Still useful for "Edit" title
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (!isCreating) { // Only fetch if adId is present (editing mode)
            const fetchAd = async () => {
                setIsLoading(true);
                setMessage({ type: '', text: '' });
                try {
                    const data = await adService.getAdDetails(adId);
                    const fetchedData = {
                        ad_title: data.ad_title || '',
                        target_url: data.target_url || '',
                        ad_copy: data.ad_copy || '',
                        keywords: Array.isArray(data.keywords) ? data.keywords.join(', ') : (data.keywords || ''),
                        budget: data.budget || '',
                        target_age_min: data.target_age_min || '',
                        target_age_max: data.target_age_max || '',
                        target_gender: data.target_gender || 'any',
                        target_locations: Array.isArray(data.target_locations) ? data.target_locations.join(', ') : (data.target_locations || ''),
                        media_type: data.media_type || 'image',
                        button_text: data.button_text || 'learn_more',
                        // media_file is not fetched, only set on new upload
                        media_file: null,
                    };
                    setAdData(fetchedData);
                    setOriginalAdData(fetchedData); // For displaying title in edit mode
                } catch (error) {
                    console.error("Failed to fetch ad details:", error);
                    setMessage({ type: 'error', text: 'Failed to load ad details. Please try again.' });
                } finally {
                    setIsLoading(false);
                }
            };
            fetchAd();
        }
        // If isCreating, we use the initial empty/default state for adData
    }, [adId, isCreating]);

    const handleChange = (e) => {
        const { name, value, type, files } = e.target;
        if (type === 'file') {
            setAdData(prev => ({ ...prev, [name]: files[0] }));
        } else {
            setAdData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        // Prepare payload, which might be FormData if media_file is present
        // The adService createAd and updateAd functions will handle FormData creation.
        const payload = { ...adData };

        // Convert budget and ages to numbers if they are not empty, otherwise null
        payload.budget = payload.budget !== '' ? Number(payload.budget) : null;
        payload.target_age_min = payload.target_age_min !== '' ? Number(payload.target_age_min) : null;
        payload.target_age_max = payload.target_age_max !== '' ? Number(payload.target_age_max) : null;

        // Keywords and locations can be sent as comma-separated strings; backend will handle parsing if needed
        // Or, if backend expects arrays for these, ensure adService or backend serializer handles string to array.
        // The AdSerializer in backend seems to expect string for keywords.

        try {
            if (isCreating) {
                // Ensure media_file is present for creation as per AdSerializer validation
                if (!payload.media_file) {
                    setMessage({ type: 'error', text: 'Media file is required to create an ad.' });
                    setIsLoading(false);
                    return;
                }
                await adService.createAd(payload);
                setMessage({ type: 'success', text: 'Ad created successfully! Redirecting...' });
            } else {
                // For update, if media_file is null, we don't want to send it,
                // so backend doesn't try to clear it or process a null file.
                if (payload.media_file === null) {
                    delete payload.media_file;
                }
                await adService.updateAd(adId, payload);
                setMessage({ type: 'success', text: 'Ad updated successfully! Redirecting...' });
            }

            setTimeout(() => {
                navigate('/my-ads'); // Navigate to MyAdsDashboard
            }, 2000);
        } catch (error) {
            console.error(`Failed to ${isCreating ? 'create' : 'update'} ad:`, error);
            const errorMsg = error.response?.data?.detail || error.message || `Failed to ${isCreating ? 'create' : 'update'} ad. Please try again.`;
            let formattedErrorMsg = errorMsg;
            if (typeof error.response?.data === 'object' && error.response.data !== null) {
                // Try to format DRF validation errors
                const errors = Object.entries(error.response.data).map(([key, value]) => {
                    return `${key}: ${Array.isArray(value) ? value.join(', ') : value}`;
                }).join('; ');
                if (errors) formattedErrorMsg = errors;
            }
            setMessage({ type: 'error', text: formattedErrorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !isCreating && !originalAdData.ad_title) { // Show full page loading only on initial edit load
        return <div style={styles.loading}>Loading ad details...</div>;
    }

    return (
        <div style={styles.container}>
            <h2>{isCreating ? 'Create New Ad' : `Edit Ad: ${originalAdData.ad_title || `ID ${adId}`}`}</h2>
            {message.text && (
                <div style={{ ...styles.message, ...(message.type === 'success' ? styles.successMessage : styles.errorMessage) }}>
                    {message.text}
                </div>
            )}
            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.formGroup}>
                    <label htmlFor="ad_title" style={styles.label}>Ad Title</label>
                    <input type="text" name="ad_title" id="ad_title" value={adData.ad_title} onChange={handleChange} style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="target_url" style={styles.label}>Target URL</label>
                    <input type="url" name="target_url" id="target_url" value={adData.target_url} onChange={handleChange} style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="ad_copy" style={styles.label}>Ad Copy</label>
                    <textarea name="ad_copy" id="ad_copy" value={adData.ad_copy} onChange={handleChange} style={styles.textarea} required />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="keywords" style={styles.label}>Keywords (comma-separated)</label>
                    <input type="text" name="keywords" id="keywords" value={adData.keywords} onChange={handleChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="media_type" style={styles.label}>Media Type</label>
                    <select name="media_type" id="media_type" value={adData.media_type} onChange={handleChange} style={styles.input}>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="media_file" style={styles.label}>Media File</label>
                    <input type="file" name="media_file" id="media_file" onChange={handleChange} style={styles.input} accept={adData.media_type === 'image' ? 'image/*' : 'video/*'} />
                    {/* Display existing media file info if editing and file not changed? For now, new upload replaces. */}
                </div>
                 <div style={styles.formGroup}>
                    <label htmlFor="button_text" style={styles.label}>Button Text</label>
                    <select name="button_text" id="button_text" value={adData.button_text} onChange={handleChange} style={styles.input}>
                        <option value="learn_more">Learn More</option>
                        <option value="shop_now">Shop Now</option>
                        <option value="sign_up">Sign Up</option>
                        <option value="download">Download</option>
                        <option value="watch_video">Watch Video</option>
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="budget" style={styles.label}>Budget (USD)</label>
                    <input type="number" name="budget" id="budget" value={adData.budget} onChange={handleChange} style={styles.input} step="0.01" min="10" required /> {/* Min budget from serializer */}
                </div>

                <h3 style={{marginTop: '20px', borderTop: '1px solid #444', paddingTop: '20px'}}>Targeting Options</h3>
                <div style={styles.formGroup}>
                    <label htmlFor="target_age_min" style={styles.label}>Target Age Min</label>
                    <input type="number" name="target_age_min" id="target_age_min" value={adData.target_age_min} onChange={handleChange} style={styles.input} min="0" />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="target_age_max" style={styles.label}>Target Age Max</label>
                    <input type="number" name="target_age_max" id="target_age_max" value={adData.target_age_max} onChange={handleChange} style={styles.input} min="0" />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="target_gender" style={styles.label}>Target Gender</label>
                    <select name="target_gender" id="target_gender" value={adData.target_gender} onChange={handleChange} style={styles.input}>
                        <option value="any">Any</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="non_binary">Non-binary</option>
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="target_locations" style={styles.label}>Target Locations (comma-separated)</label>
                    <input type="text" name="target_locations" id="target_locations" value={adData.target_locations} onChange={handleChange} style={styles.input} />
                </div>

                <div>
                    <button type="submit" disabled={isLoading} style={styles.button}>
                        {isLoading ? (isCreating ? 'Creating...' : 'Saving...') : (isCreating ? 'Create Ad & Proceed to Payment' : 'Save Changes')}
                    </button>
                    <button type="button" onClick={() => navigate('/my-ads')} style={{...styles.button, ...styles.cancelButton, marginLeft: '10px'}} disabled={isLoading}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdEditPage;
