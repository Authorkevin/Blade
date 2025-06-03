import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import chatService from '../services/chatService';

// Helper to get user ID from stored token or user object
const getMyUserIdFromLocalStorage = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        try {
            const userObject = JSON.parse(storedUser);
            // Adapt this to your user object structure, e.g., userObject.id, userObject.pk, userObject.user_id
            if (userObject && (userObject.id !== undefined)) {
                return parseInt(userObject.id, 10); // Ensure it's a number if your backend uses numeric IDs
            } else if (userObject && (userObject.pk !== undefined)) {
                 return parseInt(userObject.pk, 10);
            }
             else if (userObject && (userObject.user_id !== undefined)) {
                 return parseInt(userObject.user_id, 10);
            }
            // Try to get from 'access' token if it's a simple user ID or parseable JWT
            const accessToken = localStorage.getItem('access');
            if (accessToken) {
                // Basic check if it might be a simple ID. DO NOT use for JWT parsing in production here.
                // For JWT, use a library like jwt-decode on the client after fetching the token.
                // This part is highly dependent on your auth setup.
                // If your access token *is* the user ID (not recommended):
                // const potentialId = parseInt(accessToken, 10);
                // if (!isNaN(potentialId)) return potentialId;

                // If it's a JWT, you need to decode it. Example (requires jwt-decode library):
                // import { jwtDecode } from "jwt-decode";
                // const decoded = jwtDecode(accessToken);
                // return decoded.user_id; // Or whatever your JWT payload calls it
            }

        } catch (e) {
            console.error("Failed to parse stored user/token from localStorage:", e);
        }
    }
    console.warn("Could not retrieve current user ID from localStorage. Ensure user info or JWT is stored correctly.");
    return null;
};


const MessageDetail = () => {
    const { userId: otherUserIdParams } = useParams();
    const otherUserId = parseInt(otherUserIdParams, 10);

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [socket, setSocket] = useState(null);
    const [myUserId, setMyUserId] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const currentUserId = getMyUserIdFromLocalStorage();
        if (currentUserId) {
            setMyUserId(currentUserId);
        } else {
            setError("Your user ID could not be determined. Please log in again.");
            console.error("Failed to determine myUserId for chat.");
        }
    }, []);

    useEffect(() => {
        if (!otherUserId || isNaN(otherUserId)) {
            setError("Invalid recipient specified for the chat.");
            setLoading(false);
            return;
        }
        if (!myUserId) {
            if (!error) setError("Cannot load chat: Your user ID is not available.");
            setLoading(false);
            return;
        }

        const fetchMessages = async () => {
            try {
                setLoading(true);
                setError('');
                const historicalMessages = await chatService.getMessages(otherUserId);
                setMessages(Array.isArray(historicalMessages) ? historicalMessages : []);
            } catch (err) {
                setError(`Failed to fetch messages for user ${otherUserId}.`);
                console.error(err);
                setMessages([]);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [otherUserId, myUserId, error]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        if (!myUserId || !otherUserId || isNaN(otherUserId)) {
            console.log("WebSocket: myUserId or otherUserId not valid, skipping connection.");
            return;
        }

        const wsUrl = `ws://localhost:8001/ws/chat/${myUserId}/`;
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket connected');
            setSocket(ws);
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                     ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 1000);
        };

        ws.onmessage = (event) => {
            try {
                const receivedMsgData = JSON.parse(event.data);
                console.log('WebSocket message received:', receivedMsgData);

                if (receivedMsgData.type === "pong") {
                    console.log("Pong received from server.");
                    return;
                }

                const senderId = parseInt(receivedMsgData.from_user_id, 10);

                if (receivedMsgData.content && (senderId === otherUserId || senderId === myUserId) ) {
                     setMessages(prevMessages => [...prevMessages, {
                        id: receivedMsgData.id || `ws-${Date.now()}`, // Use server ID if available, else temp ID
                        sender: senderId,
                        sender_username: receivedMsgData.from_user_username || (senderId === myUserId ? 'You' : `User ${senderId}`),
                        recipient: senderId === myUserId ? otherUserId : myUserId, // Determine recipient based on sender
                        content: receivedMsgData.content,
                        timestamp: receivedMsgData.timestamp || new Date().toISOString(),
                    }]);
                } else {
                    console.log("Received a message not for/from the current chat partner or malformed:", receivedMsgData);
                }

            } catch (e) {
                console.error("Error parsing WebSocket message or updating state:", e);
            }
        };

        ws.onerror = (errorEvent) => {
            console.error('WebSocket error:', errorEvent);
            setError('WebSocket connection error. Real-time features may be unavailable.');
        };

        ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.reason, event.code);
            setSocket(null);
        };

        return () => {
            if (ws) {
                console.log('Closing WebSocket connection');
                ws.close();
            }
        };
    }, [myUserId, otherUserId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        if (!myUserId) {
            setError("Cannot send message: Your user ID is not set.");
            return;
        }
        if (!otherUserId || isNaN(otherUserId)) {
            setError("Cannot send message: Recipient ID is not valid.");
            return;
        }

        const messagePayloadForSocket = {
            type: "chat_message",
            to_user_id: otherUserId.toString(),
            content: newMessage,
        };

        const optimisticMessage = {
            id: `optimistic-${Date.now()}`,
            sender: myUserId,
            recipient: otherUserId,
            content: newMessage,
            timestamp: new Date().toISOString(),
            sender_username: 'You'
        };

        if (socket && socket.readyState === WebSocket.OPEN) {
            try {
                socket.send(JSON.stringify(messagePayloadForSocket));
                setMessages(prevMessages => [...prevMessages, optimisticMessage]);
                setNewMessage('');
            } catch (err) {
                console.error("Error sending message via WebSocket:", err);
                setError("Failed to send real-time message. Try again.");
                return;
            }
        } else {
            setError('WebSocket is not connected. Message cannot be sent in real-time. Attempting to save...');
            // Fall through to try REST persistence
        }

        try {
            const persistedMessage = await chatService.sendMessage(otherUserId, newMessage);
            console.log('Message persisted via REST API.', persistedMessage);
            // Replace optimistic message with persisted one if needed, or update its ID
            setMessages(prevMessages => prevMessages.map(msg =>
                msg.id === optimisticMessage.id ? { ...persistedMessage, sender_username: 'You' } : msg
            ));
             if (!socket || socket.readyState !== WebSocket.OPEN) { // If WS was down, clear message box on successful save
                setNewMessage('');
            }
        } catch (err) {
            console.error('Failed to persist message via REST API:', err);
            setError('Message may not have been saved to the server. Please check your connection.');
            // Optionally revert optimistic update if REST fails:
            // setMessages(prevMessages => prevMessages.filter(msg => msg.id !== optimisticMessage.id));
        }
    };

    if (!myUserId && !error) {
        return <p>Initializing chat... Verifying user identity.</p>;
    }

    if (error && messages.length === 0) { // Show critical errors if chat cannot function and no messages loaded
        return <p style={{ color: 'red' }}>Error: {error}</p>;
    }

    if (loading && messages.length === 0) {
        return <p>Loading messages with user {otherUserId}...</p>;
    }

    return (
        <div>
            <h3>Chat with User {otherUserId}</h3>
            {error && !loading && <p style={{color: 'orange', textAlign: 'center'}}>Notice: {error}</p>}
            <div style={{ height: '400px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column' }}>
                {messages.map((msg) => (
                    <div key={msg.id || msg.timestamp} style={{
                        alignSelf: msg.sender === myUserId ? 'flex-end' : 'flex-start',
                        marginBottom: '5px',
                        maxWidth: '70%',
                        }}>
                        <p style={{
                            backgroundColor: msg.sender === myUserId ? '#dcf8c6' : '#f0f0f0',
                            color: '#333',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            display: 'inline-block',
                            margin: '2px',
                            wordBreak: 'break-word',
                        }}>
                            <strong>{msg.sender_username || (msg.sender === myUserId ? 'You' : `User ${msg.sender}`)}:</strong>
                            <br/>
                            {msg.content}
                            <br />
                            <small style={{fontSize: '0.7em', color: '#777'}}>{new Date(msg.timestamp).toLocaleTimeString()} - {new Date(msg.timestamp).toLocaleDateString()}</small>
                        </p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} style={{display: 'flex'}}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    style={{ flexGrow: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '5px 0 0 5px' }}
                    disabled={!myUserId || loading}
                />
                <button
                    type="submit"
                    style={{ padding: '10px 15px', border: '1px solid #ccc', borderLeft: 'none', borderRadius: '0 5px 5px 0', background: '#007bff', color: 'white' }}
                    disabled={!myUserId || loading || (socket && socket.readyState !== WebSocket.OPEN && !newMessage)} // Disable if WS not open and trying to send new message
                >Send</button>
            </form>
        </div>
    );
};

export default MessageDetail;
