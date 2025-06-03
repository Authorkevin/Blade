import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Peer from 'simple-peer';
import videoCallService from '../services/videoCallService';

const getMyUserIdFromLocalStorage = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        try {
            const userObject = JSON.parse(storedUser);
            if (userObject && userObject.id !== undefined) return parseInt(userObject.id, 10);
            if (userObject && userObject.pk !== undefined) return parseInt(userObject.pk, 10);
            if (userObject && userObject.user_id !== undefined) return parseInt(userObject.user_id, 10);
        } catch (e) { console.error("Failed to parse stored user for ID:", e); }
    }
    console.warn("VideoCallPage: My user ID not found in localStorage.");
    return null;
};

const VideoCallPage = () => {
    const { roomId, callSessionIdParam, action } = useParams(); // action could be 'initiate' or 'join'
    const navigate = useNavigate();

    const [myUserId, setMyUserId] = useState(null);
    // otherUserId is the ID of the peer this client is trying to connect with.
    // It might be derived from callSession details or passed if known.
    const [otherUserId, setOtherUserId] = useState(null);

    const [stream, setStream] = useState(null);
    const [peerStream, setPeerStream] = useState(null);
    const peerRef = useRef(null); // Stores the simple-peer instance
    const socketRef = useRef(null); // Stores the WebSocket instance

    const [callSession, setCallSession] = useState(null); // Stores Django CallSession object
    const [callStatus, setCallStatus] = useState('initializing'); // idle, connecting, active, ended, error

    const myVideoRef = useRef();
    const peerVideoRef = useRef();

    // Get My User ID
    useEffect(() => {
        const id = getMyUserIdFromLocalStorage();
        if (id) setMyUserId(id);
        else {
            setCallStatus('error_no_auth');
            console.error("VideoCallPage: Current user ID could not be determined.");
        }
    }, []);

    // Fetch Call Session Details and Determine Other User
    useEffect(() => {
        if (!callSessionIdParam || !myUserId) return;

        videoCallService.getCallSessionDetails(callSessionIdParam)
            .then(session => {
                setCallSession(session);
                const peerId = myUserId === session.caller ? session.callee : session.caller;
                setOtherUserId(peerId);
                setCallStatus('ready'); // Ready to connect media / signaling
            })
            .catch(err => {
                console.error("Failed to fetch call session details:", err);
                setCallStatus('error_session_fetch');
            });
    }, [callSessionIdParam, myUserId]);


    // Get local media stream
    const getMedia = useCallback(() => {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(currentStream => {
                setStream(currentStream);
                if (myVideoRef.current) {
                    myVideoRef.current.srcObject = currentStream;
                }
                return currentStream; // Return stream for promise chaining
            })
            .catch(err => {
                console.error('Error getting user media:', err);
                setCallStatus('error_media');
                throw err; // Propagate error
            });
    }, []);

    // Initialize WebSocket for signaling
    useEffect(() => {
        if (!myUserId || !roomId || !callSession || callStatus === 'error_no_auth' || callStatus === 'error_session_fetch') {
            return; // Wait for necessary info
        }

        const wsUrl = `ws://localhost:8001/ws/video/${roomId}/${myUserId}/`;
        console.log(`VideoCall: Connecting to WebSocket: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('VideoCall WebSocket connected to room:', roomId);
            // If this client is the initiator (caller), and media is ready, start peer connection
            if (action === 'initiate' && stream && callSession && myUserId === callSession.caller) {
                console.log("Action is 'initiate', I am the caller. Creating peer and offer.");
                createPeer(true, stream); // true for initiator
            } else if (stream && callSession && myUserId === callSession.callee) {
                // Callee will wait for an offer, but can prepare peer instance
                 console.log("Action is 'join' (or I am callee). Preparing peer, waiting for offer.");
                 createPeer(false, stream); // false for non-initiator
            }
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log('VideoCall WS message received:', message);

            if (message.from_user_id === myUserId) return; // Ignore messages from self

            switch (message.type) {
                case 'user-joined':
                    // If current user is caller and the joined user is the callee, initiate offer
                    if (action !== 'initiate' && callSession && myUserId === callSession.caller && message.user_id === callSession.callee && peerRef.current && !peerRef.current.destroyed && !peerRef.current.connected) {
                        console.log(`Callee ${message.user_id} joined. Sending offer.`);
                        // This assumes peer was already created with initiator: true
                        // createPeer might need to be called here if not already.
                    } else if (myUserId === callSession.callee && message.user_id === callSession.caller && !peerRef.current) {
                        // This means caller joined, callee should prepare to receive offer
                        console.log(`Caller ${message.user_id} joined. Callee is ready.`);
                        if(stream) createPeer(false, stream); // Ensure peer is ready for offer
                    }
                    break;
                case 'offer':
                    if (peerRef.current && !peerRef.current.destroyed) {
                        console.log('Received offer, signaling to peer...');
                        peerRef.current.signal(message.data);
                        setCallStatus('connecting');
                    } else if (stream) { // If peer not created yet (e.g. callee)
                        console.log('Received offer, creating peer to handle it...');
                        createPeer(false, stream, message.data); // Create peer and signal offer
                        setCallStatus('connecting');
                    }
                    break;
                case 'answer':
                case 'ice-candidate':
                    if (peerRef.current && !peerRef.current.destroyed) {
                        peerRef.current.signal(message.data);
                    }
                    break;
                case 'call-ended':
                case 'user-left': // Treat user-left as call ended for 1-on-1
                    handleCallCleanup(`Call ended by peer or peer left.`);
                    break;
                case 'call-declined':
                    handleCallCleanup(`Call declined by peer.`);
                    break;
                default:
                    console.log('Unknown WS message type:', message.type);
            }
        };

        ws.onerror = (error) => {
            console.error('VideoCall WebSocket error:', error);
            setCallStatus('error_socket');
        };
        ws.onclose = (event) => {
            console.log('VideoCall WebSocket disconnected:', event.reason);
            if (callStatus !== 'ended' && callStatus !== 'declined') {
                // setCallStatus('error_socket_closed');
            }
        };
        return () => {
            if (ws) ws.close();
            if (peerRef.current) peerRef.current.destroy();
        };
    }, [myUserId, roomId, stream, action, callSession, getMedia]); // Dependencies

    const createPeer = (initiator, localStream, offerSignal = null) => {
        if (peerRef.current && !peerRef.current.destroyed) {
            console.log("Peer already exists. Destroying old one.");
            peerRef.current.destroy();
        }
        if (!localStream) {
            console.error("Cannot create peer: local stream is not available.");
            setCallStatus("error_media");
            return null;
        }
        if (!otherUserId) {
             console.error("Cannot create peer: other user ID not set.");
             return null;
        }

        console.log(`Creating Peer. Initiator: ${initiator}. Target Peer: ${otherUserId}`);
        const newPeer = new Peer({
            initiator: initiator,
            trickle: true,
            stream: localStream,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        newPeer.on('signal', data => {
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                let signalType = '';
                if (data.type === 'offer') signalType = 'offer';
                else if (data.type === 'answer') signalType = 'answer';
                else if (data.candidate) signalType = 'ice-candidate';

                if (signalType) {
                    console.log(`Sending ${signalType} to user ${otherUserId}`);
                    socketRef.current.send(JSON.stringify({
                        type: signalType,
                        to_user_id: otherUserId.toString(),
                        data: data
                    }));
                }
            } else {
                console.error("WebSocket not open, cannot send signal data for peer.");
            }
        });

        newPeer.on('stream', remoteStream => {
            console.log('Received remote stream');
            setPeerStream(remoteStream);
            if (peerVideoRef.current) peerVideoRef.current.srcObject = remoteStream;
            setCallStatus('active');
            // If call was accepted, update Django status
            if (callSession && callSession.status === 'pending' && myUserId === callSession.callee) {
                videoCallService.acceptCall(callSession.id).catch(e => console.error("Error accepting call on Django:", e));
            }
        });

        newPeer.on('connect', () => {
            console.log('Peer connected');
            setCallStatus('active');
        });
        newPeer.on('close', () => {
            console.log('Peer connection closed');
            handleCallCleanup('Peer connection closed.');
        });
        newPeer.on('error', err => {
            console.error('Peer error:', err);
            setCallStatus('error_peer');
        });

        peerRef.current = newPeer;
        if (offerSignal && !initiator) { // If callee and offer is already received
             console.log("Signaling received offer to newly created peer.");
             newPeer.signal(offerSignal);
        }
        return newPeer;
    };

    // Start Media and then potentially call
    useEffect(() => {
        if (myUserId && callSession && callStatus === 'ready' && !stream) { // Only get media if ready and not already obtained
            getMedia().then( (s) => { // s is the stream
                // If this client is callee and an offer is pending from a quick caller, this might be too late.
                // The WebSocket onmessage for 'offer' needs to handle creating peer if stream is ready.
                // Or, if action is 'initiate', createPeer is called in ws.onopen.
                // If action is 'join' (callee), peer is created in ws.onopen (or on 'offer' if stream ready later)
                 if (action !== 'initiate' && callSession.caller !== myUserId && s) { // I am callee
                    // Peer creation for callee is now handled in ws.onopen or on 'offer'
                    // to ensure it's ready for signaling.
                    console.log("Media obtained for callee. Peer will be/is created in WS effect.");
                }
            }).catch(e => console.error("Failed to get media in useEffect chain:", e));
        }
    }, [myUserId, callSession, callStatus, action, getMedia, stream]);


    const handleCallCleanup = useCallback((reason = "Call ended.") => {
        console.log(`Cleaning up call: ${reason}`);
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setPeerStream(null);
        // Don't close socket here, it's handled by its own lifecycle or component unmount

        if (callStatus !== 'ended' && callStatus !== 'declined') { // Avoid multiple "ended" states
            setCallStatus('ended');
        }

        // Update Django session if it was active or pending
        if (callSession && (callSession.status === 'active' || callSession.status === 'pending')) {
            videoCallService.endCall(callSession.id)
                .then(() => console.log("Call session ended on server."))
                .catch(err => console.error("Error ending call session on server:", err));
        }
        // navigate('/messages', { replace: true }); // Navigate away after cleanup
    }, [stream, callStatus, callSession, navigate]);


    const handleHangUpButton = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'hang-up', to_user_id: otherUserId?.toString() }));
        }
        handleCallCleanup('User clicked hang up.');
    };

    // Render logic
    if (callStatus === 'error_no_auth' || callStatus === 'error_session_fetch') {
        return <div><p style={{color: 'red'}}>Error: Cannot initiate video call. {callStatus}</p></div>;
    }
    if (callStatus === 'initializing' || (callStatus === 'ready' && !stream) ) {
        return <div><p>Initializing video call with {otherUserIdParam || 'peer'}... Checking media permissions...</p></div>;
    }
     if (callStatus === 'error_media') {
        return <div><p style={{color: 'red'}}>Error: Could not access camera/microphone. Please check permissions.</p></div>;
    }

    return (
        <div>
            <h2>Video Call - Room: {roomId}</h2>
            <p>My ID: {myUserId} | Peer ID: {otherUserId || 'Connecting...'} | Status: {callStatus}</p>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '10px' }}>
                <div>
                    <h4>My Video</h4>
                    <video ref={myVideoRef} autoPlay muted style={{ width: 'calc(50vw - 40px)', maxWidth: '500px', border: '1px solid black', backgroundColor: '#333' }} />
                </div>
                <div>
                    <h4>Peer Video</h4>
                    <video ref={peerVideoRef} autoPlay style={{ width: 'calc(50vw - 40px)', maxWidth: '500px', border: '1px solid black', backgroundColor: '#333' }} />
                </div>
            </div>
            <div>
                { (callStatus === 'active' || callStatus === 'connecting' || callStatus === 'ready') &&
                  callSession && callSession.status !== 'completed' && callSession.status !== 'declined' && (
                    <button onClick={handleHangUpButton} style={{padding: '10px 20px', background: 'red', color: 'white'}}>End Call</button>
                )}
                 {(callStatus === 'ended' || callStatus === 'declined' || callStatus.startsWith('error')) && (
                    <button onClick={() => navigate('/messages')} style={{padding: '10px 20px'}}>Back to Messages</button>
                )}
            </div>
        </div>
    );
};

export default VideoCallPage;
