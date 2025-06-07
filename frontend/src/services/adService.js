import api from '../api'; // Assuming api.js handles baseURL and auth headers

const AD_BASE_URL = 'ads/'; // Prefix for all ad-related calls

// Helper function to create FormData, especially for file uploads
const createAdFormData = (adData) => {
    const formData = new FormData();
    for (const key in adData) {
        if (adData.hasOwnProperty(key)) {
            if (key === 'media_file' && adData[key] instanceof File) {
                formData.append(key, adData[key], adData[key].name);
            } else if (adData[key] !== null && adData[key] !== undefined) {
                // Convert boolean to string if necessary, or ensure backend handles it.
                // For other data types like numbers or strings, direct append is fine.
                formData.append(key, adData[key]);
            }
        }
    }
    return formData;
};

export const listMyAds = () => {
    return api.get(`${AD_BASE_URL}`);
};

export const createAd = (adData) => {
    // Always use FormData for create in case media_file is included,
    // and to be consistent. Backend should be ready to handle FormData.
    const formData = createAdFormData(adData);
    return api.post(`${AD_BASE_URL}`, formData, {
        headers: {
            // 'Content-Type': 'multipart/form-data', // Axios usually sets this with FormData
        },
    });
};

export const getAdDetails = (adId) => {
    return api.get(`${AD_BASE_URL}${adId}/`);
};

export const updateAd = (adId, adData) => {
    // If media_file is present and is a File object, it means it's being changed.
    if (adData.media_file && adData.media_file instanceof File) {
        const formData = createAdFormData(adData);
        return api.patch(`${AD_BASE_URL}${adId}/`, formData, {
            headers: {
                // 'Content-Type': 'multipart/form-data',
            },
        });
    }
    // For other updates (e.g., text fields, status changes like { status: 'paused' })
    // Send as JSON.
    return api.patch(`${AD_BASE_URL}${adId}/`, adData);
};

export const deleteAd = (adId) => {
    return api.delete(`${AD_BASE_URL}${adId}/`);
};

// Functions for payment flow, potentially useful for the dashboard
export const createAdCheckoutSession = (adId) => {
    return api.post(`${AD_BASE_URL}${adId}/create-checkout-session/`);
};

export const verifyAdPayment = (sessionId) => {
    // Note: The backend URL might need adjustment if it's not exactly 'ads/verify-ad-payment/'
    // For now, assuming it's a top-level ads/ endpoint or similar.
    // Based on existing backend urls.py, it's /ads/verify-ad-payment/
    return api.get(`${AD_BASE_URL}verify-ad-payment/?session_id=${sessionId}`);
};

export const getAdBudgetEstimate = (budget) => {
    // Based on existing backend urls.py, it's /ads/estimate-budget/
    return api.post(`${AD_BASE_URL}estimate-budget/`, { budget });
};

// Functions for tracking impressions and clicks, if needed directly from ad service
export const trackAdImpression = (adId) => {
    return api.post(`${AD_BASE_URL}${adId}/track-impression/`);
};

export const trackAdClick = (adId) => {
    return api.post(`${AD_BASE_URL}${adId}/track-click/`);
};


const adService = {
    listMyAds,
    createAd,
    getAdDetails,
    updateAd,
    deleteAd,
    createAdCheckoutSession,
    verifyAdPayment,
    getAdBudgetEstimate,
    trackAdImpression,
    trackAdClick,
};

export default adService;
