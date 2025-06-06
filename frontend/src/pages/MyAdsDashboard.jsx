import React, { useEffect, useState } from 'react';
import adService from '../services/adService';
import styles from './MyAdsDashboard.styles'; // We'll create this file for styles

const MyAdsDashboard = () => {
    const [ads, setAds] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionMessage, setActionMessage] = useState({ text: '', type: '' }); // For success/error messages from actions

    useEffect(() => {
        const fetchUserAds = async () => {
            setIsLoading(true);
            setError('');
            try {
                // No need to manually pass token if 'api.js' handles it via interceptors
                const response = await adService.getMyAds();
                setAds(response.data); // Assuming response.data is the array of ads
            } catch (err) {
                console.error("Failed to fetch user ads:", err);
                setError(err.response?.data?.detail || 'Failed to load your ads. Please try again later.');
                setAds([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserAds();
    }, []);

    const calculateCTR = (clicks, impressions) => {
        if (impressions === 0 || !impressions) {
            return "N/A";
        }
        return ((clicks / impressions) * 100).toFixed(2) + '%';
    };

    const formatBudget = (budget) => {
        const num = parseFloat(budget);
        if (isNaN(num)) {
            return "N/A";
        }
        return `$${num.toFixed(2)}`;
    };

    const statusDisplayMap = {
        'pending_review': 'Pending Review',
        'pending_approval': 'Pending Approval',
        'live': 'Live',
        'paused': 'Paused',
        'completed': 'Completed',
        'rejected': 'Rejected',
    };

    const handleDeleteAd = async (adId) => {
        if (window.confirm('Are you sure you want to delete this ad? This action cannot be undone.')) {
            try {
                await adService.deleteAd(adId);
                setAds(prevAds => prevAds.filter(ad => ad.id !== adId));
                setActionMessage({ text: 'Ad deleted successfully.', type: 'success' });
            } catch (err) {
                console.error("Failed to delete ad:", err);
                setActionMessage({ text: err.response?.data?.detail || 'Failed to delete ad.', type: 'error' });
            }
        }
    };

    const handleUpdateAdStatus = async (adId, newStatus) => {
        try {
            const response = await adService.updateAdStatus(adId, newStatus);
            setAds(prevAds => prevAds.map(ad => ad.id === adId ? { ...ad, status: response.data.status } : ad));
            setActionMessage({ text: `Ad status updated to ${statusDisplayMap[newStatus] || newStatus}.`, type: 'success' });
        } catch (err) {
            console.error("Failed to update ad status:", err);
            setActionMessage({ text: err.response?.data?.detail || `Failed to update ad status. Error: ${err.message}`, type: 'error' });
        }
    };


    if (isLoading) {
        return <div style={styles.pageContainer}><p style={styles.loadingMessage}>Loading your ad campaigns...</p></div>;
    }

    // Show general fetch error first if it exists
    if (error && !ads.length) { // only show general error if ads haven't loaded
        return <div style={styles.pageContainer}><p style={styles.errorMessage}>{error}</p></div>;
    }

    return (
        <div style={styles.pageContainer}>
            <h2 style={styles.heading}>My Ad Campaigns</h2>

            {actionMessage.text && (
                <div style={actionMessage.type === 'success' ? styles.successMessage : styles.errorMessage}>
                    {actionMessage.text}
                </div>
            )}
             {error && ads.length > 0 && ( // Show general fetch error even if some ads are displayed (e.g. from cache then failed update)
                <p style={styles.errorMessage}>{error}</p>
            )}


            {ads.length === 0 && !isLoading ? ( // Check !isLoading here
                <p style={styles.infoMessage}>You haven't created any ads yet. <a href="/create-ad" style={styles.link}>Create your first ad!</a></p>
            ) : (
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Title</th>
                                <th style={styles.th}>Status</th>
                                <th style={styles.th}>Budget</th>
                                <th style={styles.th}>Impressions</th>
                                <th style={styles.th}>Clicks</th>
                                <th style={styles.th}>CTR</th>
                                <th style={styles.th}>Actions</th> {/* New Actions column */}
                            </tr>
                        </thead>
                        <tbody>
                            {ads.map(ad => (
                                <tr key={ad.id} style={styles.tr}>
                                    <td style={styles.td}>{ad.ad_title}</td>
                                    <td style={styles.td}>
                                        <span style={styles.statusIndicator[ad.status] || styles.statusIndicator.default}>
                                            {statusDisplayMap[ad.status] || ad.status}
                                        </span>
                                    </td>
                                    <td style={styles.td}>{formatBudget(ad.budget)}</td>
                                    <td style={styles.td}>{ad.impressions !== undefined ? ad.impressions.toLocaleString() : '0'}</td>
                                    <td style={styles.td}>{ad.clicks !== undefined ? ad.clicks.toLocaleString() : '0'}</td>
                                    <td style={styles.td}>{calculateCTR(ad.clicks, ad.impressions)}</td>
                                    <td style={styles.td}>
                                        {ad.status === 'live' && (
                                            <button
                                                onClick={() => handleUpdateAdStatus(ad.id, 'paused')}
                                                style={{...styles.actionButton, ...styles.pauseButton}}>
                                                Pause
                                            </button>
                                        )}
                                        {ad.status === 'paused' && (
                                            <button
                                                onClick={() => handleUpdateAdStatus(ad.id, 'live')}
                                                style={{...styles.actionButton, ...styles.resumeButton}}>
                                                Resume
                                            </button>
                                        )}
                                        {/* Allow deletion for most statuses except perhaps 'completed' or if it has active billing issues */}
                                        {/* For now, enable delete for non-completed ads */}
                                        {ad.status !== 'completed' && (
                                             <button
                                                onClick={() => handleDeleteAd(ad.id)}
                                                style={{...styles.actionButton, ...styles.deleteButton}}>
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MyAdsDashboard;
