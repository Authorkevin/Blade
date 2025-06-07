import api from '../api'; // Assuming 'api.js' is your configured Axios instance or fetch wrapper

const adService = {
    trackImpression: (adId) => {
        return api.post(`/ads/${adId}/track-impression/`);
    },
    trackClick: (adId) => {
        return api.post(`/ads/${adId}/track-click/`); // This will return the target_url in the response data
    },
    getMyAds: () => {
        return api.get('/ads/'); // Assumes token is handled by api interceptor
    },
    deleteAd: (adId) => {
        return api.delete(`/ads/${adId}/`);
    },
    updateAdStatus: (adId, newStatus) => {
        return api.patch(`/ads/${adId}/`, { status: newStatus });
    },
    getAdDetails: async (adId) => {
        try {
            const response = await api.get(`/ads/${adId}/`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching details for ad ${adId}:`, error.response ? error.response.data : error.message);
            throw error;
        }
    },
    updateAd: async (adId, adData) => {
        // Assuming adData is a plain JavaScript object for non-file fields
        try {
            const response = await api.patch(`/ads/${adId}/`, adData);
            return response.data;
        } catch (error) {
            console.error(`Error updating ad ${adId}:`, error.response ? error.response.data : error.message);
            throw error;
        }
    },
};

export default adService;
