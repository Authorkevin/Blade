import pytest
from fastapi.testclient import TestClient
import json
import asyncio # For yielding control if needed for WebSockets

# Assuming your FastAPI app instance is named 'app' in 'main.py'
# Adjust the import path if your file structure is different or main.py is not in root.
# For this structure, if test_main.py is in the same directory as main.py:
from main import app, video_rooms, active_chat_connections

@pytest.fixture(autouse=True)
def clear_global_state_fixture(): # Renamed to avoid potential name collision
    """Clears the in-memory state before each test."""
    video_rooms.clear()
    active_chat_connections.clear()

def test_chat_websocket_connection_and_ping():
    client = TestClient(app)
    user_id = "testuser_chat_ping"
    with client.websocket_connect(f"/ws/chat/{user_id}/") as websocket:
        assert user_id in active_chat_connections
        assert active_chat_connections[user_id] is not None

        ping_message = {"type": "ping"}
        websocket.send_text(json.dumps(ping_message))
        response = websocket.receive_text() # FastAPI TestClient handles async nature
        assert json.loads(response) == {"type": "pong"}

    assert user_id not in active_chat_connections # Check removal after disconnect

def test_chat_message_routing_between_two_users():
    client = TestClient(app)
    user1_id = "chat_sender"
    user2_id = "chat_receiver"

    with client.websocket_connect(f"/ws/chat/{user1_id}/") as ws1, \
         client.websocket_connect(f"/ws/chat/{user2_id}/") as ws2:

        assert user1_id in active_chat_connections
        assert user2_id in active_chat_connections

        message_content = "Hello User2 from User1"
        message_to_user2 = {
            "to_user_id": user2_id,
            "content": message_content
            # "type": "chat_message" is default if not provided in current main.py
        }
        ws1.send_text(json.dumps(message_to_user2))

        response_ws2 = ws2.receive_text()
        received_data_ws2 = json.loads(response_ws2)
        assert received_data_ws2["from_user_id"] == user1_id
        assert received_data_ws2["content"] == message_content
        assert received_data_ws2["type"] == "chat_message"

        # Test sending message to non-existent user (optional, based on server behavior)
        # message_to_non_existent = {"to_user_id": "ghost", "content": "Are you there?"}
        # ws1.send_text(json.dumps(message_to_non_existent))
        # No response expected back to ws1 from server for this case in current code.

def test_video_websocket_join_and_leave_notifications():
    client = TestClient(app)
    room_id = "test_room_notifications"
    user1_id = "vid_user1_notify"
    user2_id = "vid_user2_notify"

    with client.websocket_connect(f"/ws/video/{room_id}/{user1_id}/") as ws1:
        assert room_id in video_rooms
        assert user1_id in video_rooms[room_id]

        with client.websocket_connect(f"/ws/video/{room_id}/{user2_id}/") as ws2:
            assert user2_id in video_rooms[room_id]

            # ws1 (user1) should receive 'user-joined' notification for user2
            response_ws1_join = ws1.receive_text()
            data_ws1_join = json.loads(response_ws1_join)
            assert data_ws1_join["type"] == "user-joined"
            assert data_ws1_join["user_id"] == user2_id

        # After ws2 disconnects, ws1 (user1) should receive 'user-left' notification
        response_ws1_leave = ws1.receive_text()
        data_ws1_leave = json.loads(response_ws1_leave)
        assert data_ws1_leave["type"] == "user-left"
        assert data_ws1_leave["user_id"] == user2_id

        assert user2_id not in video_rooms[room_id] # User2 removed from room state

    assert room_id not in video_rooms # Room removed as it's empty

def test_video_signaling_message_relay_offer_answer():
    client = TestClient(app)
    room_id = "test_room_signaling"
    user1_id = "sig_user1" # Initiator/Caller
    user2_id = "sig_user2" # Receiver/Callee

    with client.websocket_connect(f"/ws/video/{room_id}/{user1_id}/") as ws_caller, \
         client.websocket_connect(f"/ws/video/{room_id}/{user2_id}/") as ws_callee:

        # Caller (ws_caller) consumes the 'user-joined' message from callee
        join_msg_for_caller = ws_caller.receive_text()
        assert json.loads(join_msg_for_caller)['user_id'] == user2_id

        # 1. Caller sends an offer to Callee
        offer_payload = {"sdp": "caller_offer_sdp_content", "type": "offer"}
        caller_sends_offer_msg = {
            "type": "offer", # For server routing
            "to_user_id": user2_id,
            "data": offer_payload
        }
        ws_caller.send_text(json.dumps(caller_sends_offer_msg))

        # Callee should receive the offer
        callee_receives_offer_msg = ws_callee.receive_text()
        callee_offer_data = json.loads(callee_receives_offer_msg)
        assert callee_offer_data["type"] == "offer" # For client handling
        assert callee_offer_data["from_user_id"] == user1_id
        assert callee_offer_data["data"] == offer_payload

        # 2. Callee sends an answer back to Caller
        answer_payload = {"sdp": "callee_answer_sdp_content", "type": "answer"}
        callee_sends_answer_msg = {
            "type": "answer", # For server routing
            "to_user_id": user1_id,
            "data": answer_payload
        }
        ws_callee.send_text(json.dumps(callee_sends_answer_msg))

        # Caller should receive the answer
        caller_receives_answer_msg = ws_caller.receive_text()
        caller_answer_data = json.loads(caller_receives_answer_msg)
        assert caller_answer_data["type"] == "answer" # For client handling
        assert caller_answer_data["from_user_id"] == user2_id
        assert caller_answer_data["data"] == answer_payload

# Further tests could include:
# - ICE candidate relay.
# - Hang-up messages.
# - Call declined messages.
# - Error conditions (e.g., sending to non-existent user in room).
# - Room becoming empty and being deleted.
```
