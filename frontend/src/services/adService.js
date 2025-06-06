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
    }
};

export default adService;
