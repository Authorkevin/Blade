import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import chatService from '../services/chatService';
import videoCallService from '../services/videoCallService'; // For initiating calls
import PaymentModal from '../components/PaymentModal'; // The new payment modal

// Helper to get current user's ID (e.g., from localStorage)
// This needs to be robust in a real application
const getMyUserId = () => {
    const user = localStorage.getItem('user');
    if (user) {
        try {
            return JSON.parse(user).id || JSON.parse(user).pk;
        } catch (e) { return null; }
    }
    return null;
};


const MessagesPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // State for payment modal
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentClientSecret, setPaymentClientSecret] = useState(null);
    const [currentCallSession, setCurrentCallSession] = useState(null); // To store {id, room_id, calleeUsername, priceAmount}
    const [isInitiatingCall, setIsInitiatingCall] = useState(false);


    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);
                setError('');
                const data = await chatService.getUsers();
                const myUserId = getMyUserId(); // Exclude self from list of users to call
                setUsers(Array.isArray(data) ? data.filter(u => u.id !== myUserId) : []);
            } catch (err) {
                setError('Failed to fetch users. Please try again later.');
                console.error(err);
                setUsers([]);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const handleInitiateCall = async (callee) => {
        if (!callee || callee.id === undefined) {
            setError("Selected user is invalid.");
            return;
        }
        setIsInitiatingCall(true);
        setError(''); // Clear previous errors
        try {
            // videoCallService.initiateCall expects calleeId
            const response = await videoCallService.initiateCall(callee.id);

            if (response.payment_client_secret) {
                // Paid call flow
                setPaymentClientSecret(response.payment_client_secret);
                setCurrentCallSession({
                    id: response.id, // CallSession ID
                    roomId: response.room_id,
                    calleeUsername: callee.username, // or response.callee_username
                    priceAmount: response.price_amount
                });
                setShowPaymentModal(true);
            } else {
                // Free call flow or error in paid flow setup (handled by initiateCall service)
                // Navigate directly to video call page
                // The action 'initiate' tells VideoCallPage this user is the caller
                navigate(`/video-call/${response.room_id}/${response.id}/initiate`);
            }
        } catch (err) {
            console.error('Error initiating call:', err);
            setError(err.detail || err.message || 'Failed to initiate call. Callee may not have payment setup or other error.');
        } finally {
            setIsInitiatingCall(false);
        }
    };

    const handlePaymentSuccess = (callSessionId, paymentIntentId) => {
        setShowPaymentModal(false);
        setPaymentClientSecret(null);
        console.log(`Payment successful for session ${callSessionId}, PI: ${paymentIntentId}. Navigating to call.`);
        // currentCallSession should have the room_id
        if (currentCallSession && currentCallSession.roomId) {
             // Navigate to video call page, action 'initiate' as payment is done by caller
            navigate(`/video-call/${currentCallSession.roomId}/${callSessionId}/initiate`);
        } else {
            setError("Call session details are missing after payment. Cannot proceed to call.");
        }
    };

    const handlePaymentModalClose = () => {
        setShowPaymentModal(false);
        setPaymentClientSecret(null);
        setCurrentCallSession(null);
        // Optionally, could inform backend that payment was cancelled by user if PI was created.
        // For now, just closing modal. CallSession would remain 'pending_payment'.
    };


    if (loading) {
        return <p>Loading users...</p>;
    }

    if (error && !isInitiatingCall) { // Don't show global error if it's just a call initiation error shown elsewhere
        return <p style={{ color: 'red' }}>{error}</p>;
    }

    return (
        <div>
            <h2>Users / Start New Chat or Call</h2>
            {isInitiatingCall && <p>Initiating call, please wait...</p>}
            {error && isInitiatingCall && <p style={{ color: 'red' }}>Call Error: {error}</p>}

            {users.length === 0 ? (
                <p>No other users available to chat or call.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {users.map(user => (
                        <li key={user.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Link to={`/messages/${user.id}`} style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>
                                    {user.username}
                                </Link>
                                <span style={{fontSize: '0.9em', color: '#666', marginLeft: '10px'}}>
                                    (ID: {user.id}) {/* Display ID for clarity if needed for testing */}
                                </span>
                            </div>
                            <div>
                                <Link to={`/messages/${user.id}`} style={{ marginRight: '10px', padding: '5px 10px', background: '#6c757d', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                                    Chat
                                </Link>
                                <button
                                    onClick={() => handleInitiateCall(user)}
                                    disabled={isInitiatingCall}
                                    style={{ padding: '5px 10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Video Call
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {showPaymentModal && currentCallSession && paymentClientSecret && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={handlePaymentModalClose}
                    clientSecret={paymentClientSecret}
                    callSessionId={currentCallSession.id}
                    onSuccess={handlePaymentSuccess}
                    callDetails={{ // Pass details to display on modal
                        calleeUsername: currentCallSession.calleeUsername,
                        priceAmount: currentCallSession.priceAmount
                    }}
                />
            )}
        </div>
    );
};

export default MessagesPage;
