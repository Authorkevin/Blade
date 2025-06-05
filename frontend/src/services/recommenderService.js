import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/recommender';

const getAuthToken = () => localStorage.getItem('access');

const axiosInstance = axios.create({ baseURL: API_BASE_URL });

axiosInstance.interceptors.request.use(config => {
    const token = getAuthToken();
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
}, error => Promise.reject(error));

export const getRecommendations = async (count = 10) => {
    try {
        const response = await axiosInstance.get(`/recommendations/?count=${count}`);
        // Ensure it returns an array even if items key is missing or response.data is unexpected
        return response.data && Array.isArray(response.data.items) ? response.data.items : [];
    } catch (error) {
        console.error('Error fetching recommendations:', error.response ? error.response.data : error.message);
        // Return empty array on error to prevent frontend crashes if component expects array
        return [];
    }
};

// Function to post an interaction (like, watch, etc.)
// interactionData should include: { video: videoId (integer), liked: true/false/null, watch_time_seconds: N (integer), completed_watch: true/false, etc. }
export const postInteraction = async (interactionData) => {
    if (interactionData.video === undefined || interactionData.video === null) {
        console.error("Video ID is required to post interaction.");
        throw new Error("Video ID is required.");
    }
    try {
        // POST to /api/recommender/interactions/
        const response = await axiosInstance.post('/interactions/', interactionData);
        return response.data;
    } catch (error) {
        console.error('Error posting interaction:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error('Failed to post interaction');
    }
};

// Specific helper for "like" a video
export const likeVideo = async (videoId) => {
    return postInteraction({ video: videoId, liked: true });
};

// Specific helper for "unlike" (if supported by setting liked: false)
export const unlikeVideo = async (videoId) => {
    return postInteraction({ video: videoId, liked: false });
};


// Specific helper for "mark as watched" (completed)
export const markAsWatched = async (videoId, watchTime = 300) => { // Assume 5 mins for a full watch, or pass actual
    return postInteraction({ video: videoId, completed_watch: true, watch_time_seconds: watchTime });
};


const recommenderService = {
    getRecommendations,
    postInteraction,
    likeVideo,
    unlikeVideo,
    markAsWatched,
};

export default recommenderService;
