import axios from 'axios';

const API_URL = 'http://localhost:8000/api/chat'; // Assuming Django backend runs here

// Function to get the JWT token from localStorage
const getAuthToken = () => {
    return localStorage.getItem('access');
};

// Axios instance with auth header
const axiosInstance = axios.create({
    baseURL: API_URL,
});

axiosInstance.interceptors.request.use(config => {
    const token = getAuthToken();
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

// Fetch list of users the current user can chat with
export const getUsers = async () => {
    try {
        const response = await axiosInstance.get('/users/'); // Endpoint from chat/urls.py
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error.response ? error.response.data : error.message);
        throw error;
    }
};

// Fetch messages between the logged-in user and another user
export const getMessages = async (otherUserId) => {
    try {
        // Ensure otherUserId is not undefined or null before making the call
        if (otherUserId === undefined || otherUserId === null) {
            throw new Error("otherUserId cannot be null or undefined when fetching messages.");
        }
        const response = await axiosInstance.get(`/messages/?user_id=${otherUserId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching messages:', error.response ? error.response.data : error.message);
        throw error;
    }
};

// Send a new message
export const sendMessage = async (recipientId, content) => {
    try {
        if (recipientId === undefined || recipientId === null) {
            throw new Error("recipientId cannot be null or undefined when sending a message.");
        }
        if (content === undefined || content === null || content.trim() === "") {
            throw new Error("Message content cannot be empty.");
        }
        const response = await axiosInstance.post('/messages/', {
            recipient: recipientId, // This should be the ID of the user
            content: content,
        });
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error.response ? error.response.data : error.message);
        throw error;
    }
};

const chatService = {
    getUsers,
    getMessages,
    sendMessage,
};

// Simulate Stripe Connect Onboarding
export const simulateStripeConnectOnboarding = async (callRate) => {
    try {
        // The endpoint is /api/chat/stripe/connect-account-simulation/
        // axiosInstance is already configured with baseURL /api/chat
        const response = await axiosInstance.post('/stripe/connect-account-simulation/', { call_rate: callRate });
        return response.data;
    } catch (error) {
        console.error('Error simulating Stripe Connect onboarding:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error('Failed to simulate Stripe Connect onboarding');
    }
};


// Add the new function to the default export if you want to import it as chatService.simulateStripeConnectOnboarding
// Otherwise, it can be imported as a named export: import { simulateStripeConnectOnboarding } from '...'
const enhancedChatService = {
    ...chatService,
    simulateStripeConnectOnboarding,
};

export default enhancedChatService;
// Alternatively, keep original default export and export new function named:
// export default chatService;
// export { simulateStripeConnectOnboarding };
// For this case, modifying the default export is simpler for direct use.
