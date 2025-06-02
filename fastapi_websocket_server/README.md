# FastAPI WebSocket Server

This server handles real-time WebSocket communication for the application, supporting:
- Text Chat Messaging
- WebRTC Signaling for Video Calls

## Purpose

The primary role of this server is to manage persistent WebSocket connections with clients and relay messages between them.

-   **For Text Chat (`/ws/chat/{user_id}/`):**
    -   Accepts WebSocket connections from authenticated users.
    -   Receives chat messages from a client and forwards them to the specified recipient client if connected.
    -   Does not handle message persistence (this is done by the Django backend via REST API calls from the client).

-   **For Video Call Signaling (`/ws/video/{room_id}/{user_id}/`):**
    -   Manages users within specific "rooms" identified by a `room_id`.
    -   Relays WebRTC signaling messages (offers, answers, ICE candidates) between peers in the same room to facilitate the establishment of peer-to-peer video connections.
    -   Handles user join/leave notifications within a room and other call control signals (e.g., hang-up, decline).

## Setup and Running

1.  **Navigate to this directory:**
    ```bash
    cd fastapi_websocket_server
    ```

2.  **Create and activate a virtual environment (recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements-fastapi.txt
    ```

4.  **Run the FastAPI server using Uvicorn:**
    ```bash
    uvicorn main:app --reload --port 8001
    ```
    -   `main:app`: Refers to the `app` instance in `main.py`.
    -   `--reload`: Enables auto-reloading on code changes (for development).
    -   `--port 8001`: Runs the server on `http://localhost:8001`. WebSocket connections will be on `ws://localhost:8001`.

## Authentication

Currently, authentication for WebSocket connections is basic and relies on `user_id` passed in the URL path. For production, a more secure token-based authentication mechanism (e.g., validating a JWT passed as a query parameter or subprotocol during WebSocket handshake) should be implemented.

## Message Format

-   **Chat:** Expects JSON messages like `{"to_user_id": "recipient_id", "content": "Hello!"}`.
-   **Video Signaling:** Expects JSON messages like `{"type": "offer", "to_user_id": "peer_id", "data": {...sdp_or_candidate...}}`. Types include `offer`, `answer`, `ice-candidate`, `user-joined`, `user-left`, `hang-up`, `call-declined`.
```
