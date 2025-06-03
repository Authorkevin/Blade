import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/chat'; // Using the same base as chat for now

// Function to get the JWT token from localStorage
const getAuthToken = () => {
    return localStorage.getItem('access');
};

// Axios instance with auth header
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
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

// Initiate a new call session
export const initiateCall = async (calleeId) => {
    try {
        // Ensure calleeId is a number if your backend expects an integer PK
        const numericCalleeId = parseInt(calleeId, 10);
        if (isNaN(numericCalleeId)) {
            throw new Error("Invalid callee ID format.");
        }
        const response = await axiosInstance.post('/call-sessions/', { callee: numericCalleeId });
        return response.data; // Expected to return CallSession object with room_id
    } catch (error) {
        console.error('Error initiating call:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error('Failed to initiate call');
    }
};

// Accept a call
export const acceptCall = async (sessionId) => {
    try {
        const response = await axiosInstance.post(`/call-sessions/${sessionId}/accept_call/`);
        return response.data;
    } catch (error) {
        console.error('Error accepting call:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error('Failed to accept call');
    }
};

// Decline a call
export const declineCall = async (sessionId) => {
    try {
        const response = await axiosInstance.post(`/call-sessions/${sessionId}/decline_call/`);
        return response.data;
    } catch (error) {
        console.error('Error declining call:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error('Failed to decline call');
    }
};

// End an ongoing or pending call
export const endCall = async (sessionId) => {
    try {
        const response = await axiosInstance.post(`/call-sessions/${sessionId}/end_call/`);
        return response.data;
    } catch (error) {
        console.error('Error ending call:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error('Failed to end call');
    }
};

// Fetch details of a specific call session (optional, if needed)
export const getCallSessionDetails = async (sessionId) => {
    try {
        const response = await axiosInstance.get(`/call-sessions/${sessionId}/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching call session details:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error('Failed to fetch call session details');
    }
};

// Confirm payment for a call session
export const confirmPayment = async (sessionId) => {
    try {
        // The backend endpoint is `/api/chat/call-sessions/{id}/confirm-payment/`
        const response = await axiosInstance.post(`/call-sessions/${sessionId}/confirm-payment/`);
        return response.data;
    } catch (error) {
        console.error('Error confirming payment:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error('Failed to confirm payment with server');
    }
};

const videoCallService = {
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    getCallSessionDetails,
    confirmPayment, // Added confirmPayment
};

export default videoCallService;
