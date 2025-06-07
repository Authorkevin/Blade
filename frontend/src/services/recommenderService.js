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

export const getRecommendations = async (params = { page: 1 }) => { // Accept a params object, default to page 1
    try {
        // Construct query parameters. Only include page for now.
        const queryParams = new URLSearchParams();
        if (params && params.page) {
            queryParams.append('page', params.page);
        }
        // If other parameters like page_size were needed, they could be added here.
        // For example: if (params.pageSize) queryParams.append('page_size', params.pageSize);

        const response = await axiosInstance.get(`/recommendations/?${queryParams.toString()}`);
        // The backend's paginated response is expected to be in response.data directly
        // It usually includes 'count', 'next', 'previous', 'results'
        // Home.jsx expects an object with 'results' and 'next' for pagination logic
        return response.data; // Return the whole response data for Home.jsx to handle
    } catch (error) {
        console.error('Error fetching recommendations:', error.response ? error.response.data : error.message);
        // To align with Home.jsx's error handling and expectation of response.results
        // we should throw the error or return a structure that indicates failure,
        // or ensure Home.jsx handles this gracefully.
        // For now, re-throwing allows Home.jsx's catch block to handle it.
        throw error;
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
