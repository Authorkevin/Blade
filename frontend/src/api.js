import axios from "axios"
import {ACCESS_TOKEN} from "./constants"

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL
});


api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem(ACCESS_TOKEN);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Post related API calls
export const likePost = (postId) => {
    return api.post(`posts/${postId}/like/`); // Removed leading /api
};

export const unlikePost = (postId) => {
    return api.delete(`posts/${postId}/like/`); // Removed leading /api
};

// Comment related API calls
export const getComments = (postId) => {
    return api.get(`/posts/${postId}/comments/`); // Removed leading /api
};

export const addComment = (postId, commentData) => {
    // commentData should be an object like { text: "your comment text" }
    return api.post(`posts/${postId}/comments/`, commentData); // Removed leading /api
};

// Engagement related API calls
export const recordEngagement = (postId, watchTimeIncrement) => {
    const payload = {};
    if (watchTimeIncrement !== null && watchTimeIncrement !== undefined) {
        payload.watch_time_increment = watchTimeIncrement;
    }
    // If watchTimeIncrement is 0, null, or undefined, the backend treats it as a "new view" call.
    // If it's positive, it's a "watch time" update.
    return api.post(`posts/${postId}/record-engagement/`, payload);
};

// Example of how other specific calls might be structured:
// export const getPosts = () => api.get("/api/posts/");
// export const createPost = (postData) => api.post("/api/posts/", postData);


export default api;
