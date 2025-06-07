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

    const [adData, setAdData] = useState({
        ad_title: '',
        target_url: '',
        ad_copy: '',
        keywords: '', // Assuming keywords are a comma-separated string
        budget: '', // Assuming budget is a number
        target_age_min: '',
        target_age_max: '',
        target_gender: '', // e.g., 'any', 'male', 'female'
        target_locations: '', // Assuming comma-separated string
        // media_file is excluded for basic edit
    });
    const [originalAdData, setOriginalAdData] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
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
                };
                setAdData(fetchedData);
                setOriginalAdData(fetchedData);
            } catch (error) {
                console.error("Failed to fetch ad details:", error);
                setMessage({ type: 'error', text: 'Failed to load ad details. Please try again.' });
            } finally {
                setIsLoading(false);
            }
        };
        if (adId) {
            fetchAd();
        }
    }, [adId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setAdData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        // For simplicity, sending all editable fields.
        // A more robust version would send only changed fields.
        const payload = {
            ...adData,
            // Convert budget to number if it's not empty
            budget: adData.budget !== '' ? Number(adData.budget) : null,
            target_age_min: adData.target_age_min !== '' ? Number(adData.target_age_min) : null,
            target_age_max: adData.target_age_max !== '' ? Number(adData.target_age_max) : null,
            keywords: adData.keywords.split(',').map(kw => kw.trim()).filter(kw => kw),
            target_locations: adData.target_locations.split(',').map(loc => loc.trim()).filter(loc => loc),
        };

        // Remove fields that backend might not expect or are empty in a way that's problematic
        if (payload.budget === null) delete payload.budget;
        if (payload.target_age_min === null) delete payload.target_age_min;
        if (payload.target_age_max === null) delete payload.target_age_max;


        try {
            await adService.updateAd(adId, payload);
            setMessage({ type: 'success', text: 'Ad updated successfully! Redirecting...' });
            setTimeout(() => {
                navigate('/ad-center'); // Or wherever MyAdsDashboard is
            }, 2000);
        } catch (error) {
            console.error("Failed to update ad:", error);
            const errorMsg = error.response?.data?.detail || error.message || 'Failed to update ad. Please try again.';
            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !adData.ad_title) { // Show full page loading only on initial load
        return <div style={styles.loading}>Loading ad details...</div>;
    }

    return (
        <div style={styles.container}>
            <h2>Edit Ad: {originalAdData.ad_title || `ID ${adId}`}</h2>
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
                    <label htmlFor="budget" style={styles.label}>Budget (USD)</label>
                    <input type="number" name="budget" id="budget" value={adData.budget} onChange={handleChange} style={styles.input} step="0.01" min="0" />
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
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => navigate('/ad-center')} style={{...styles.button, ...styles.cancelButton, marginLeft: '10px'}} disabled={isLoading}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdEditPage;
