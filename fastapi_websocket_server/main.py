from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, List, Any
import json
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# In-memory store for active connections
# For chat: Dict[user_id (str), WebSocket]
active_chat_connections: Dict[str, WebSocket] = {}

# For video calls: Dict[room_id (str), Dict[user_id (str), WebSocket]]
# This allows multiple users per room, each identified by their user_id.
video_rooms: Dict[str, Dict[str, WebSocket]] = {}


# Helper function to broadcast messages to all clients in a video room except the sender
async def broadcast_to_video_room(room_id: str, user_id: str, message: str):
    if room_id in video_rooms:
        for client_user_id, client_ws in video_rooms[room_id].items():
            if client_user_id != user_id: # Don't send to self
                try:
                    await client_ws.send_text(message)
                    logger.info(f"Room {room_id}: Sent to {client_user_id}: {message}")
                except Exception as e:
                    logger.error(f"Room {room_id}: Error sending to {client_user_id}: {e}")
                    # Consider removing unresponsive client from room
                    # video_rooms[room_id].pop(client_user_id, None)


@app.websocket("/ws/chat/{user_id}/")
async def websocket_chat_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()
    active_chat_connections[user_id] = websocket
    logger.info(f"Chat User {user_id} connected. Total chat connections: {len(active_chat_connections)}")

    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Chat message from {user_id}: {data}")
            try:
                message_data = json.loads(data)
                to_user_id = message_data.get("to_user_id")
                content = message_data.get("content")
                message_type = message_data.get("type", "chat_message")

                if message_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                    continue

                if to_user_id and content:
                    recipient_socket = active_chat_connections.get(to_user_id)
                    outgoing_message = json.dumps({
                        "from_user_id": user_id,
                        "content": content,
                        "type": "chat_message"
                    })
                    if recipient_socket:
                        await recipient_socket.send_text(outgoing_message)
                        logger.info(f"Chat message sent from {user_id} to {to_user_id}")
                    else:
                        logger.info(f"Chat User {to_user_id} not connected.")
                        # await websocket.send_text(json.dumps({"error": f"User {to_user_id} is not online."}))
                else:
                    await websocket.send_text(json.dumps({"error": "Invalid chat message format."}))
            except json.JSONDecodeError:
                logger.error("Received invalid JSON in chat.")
                await websocket.send_text(json.dumps({"error": "Invalid JSON format."}))
            except Exception as e:
                logger.error(f"Chat: Error processing message: {e}")
                await websocket.send_text(json.dumps({"error": "Error processing your message."}))
    except WebSocketDisconnect:
        logger.info(f"Chat User {user_id} disconnected.")
    finally:
        if user_id in active_chat_connections:
            del active_chat_connections[user_id]
            logger.info(f"Chat User {user_id} connection removed. Total chat connections: {len(active_chat_connections)}")


@app.websocket("/ws/video/{room_id}/{user_id}/")
async def websocket_video_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    await websocket.accept()
    logger.info(f"Video User {user_id} attempting to join Room {room_id}")

    if room_id not in video_rooms:
        video_rooms[room_id] = {}

    # Optional: Limit room size, e.g., only 2 users for a 1-on-1 call
    # if len(video_rooms[room_id]) >= 2 and user_id not in video_rooms[room_id]:
    #     logger.warning(f"Room {room_id} is full. User {user_id} cannot join.")
    #     await websocket.send_text(json.dumps({"type": "error", "message": "Room is full."}))
    #     await websocket.close(code=1008) # Policy violation or custom code
    #     return

    video_rooms[room_id][user_id] = websocket
    logger.info(f"Video User {user_id} joined Room {room_id}. Room members: {list(video_rooms[room_id].keys())}")

    # Notify other users in the room that a new user has joined
    join_notification = json.dumps({"type": "user-joined", "user_id": user_id})
    await broadcast_to_video_room(room_id, user_id, join_notification) # Exclude sender

    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Video Room {room_id}, User {user_id}: Received data: {data}")

            message_data = {}
            try:
                message_data = json.loads(data)
            except json.JSONDecodeError:
                logger.error(f"Video Room {room_id}, User {user_id}: Invalid JSON: {data}")
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON format."}))
                continue

            signal_type = message_data.get("type")
            target_user_id = message_data.get("to_user_id") # For direct signals like offer/answer to specific peer

            # Relay WebRTC signals (offer, answer, ice-candidate)
            if signal_type in ["offer", "answer", "ice-candidate"]:
                payload_to_send = json.dumps({
                    "type": signal_type,
                    "from_user_id": user_id,
                    "data": message_data.get("data") # The actual SDP or candidate
                })
                if target_user_id and target_user_id in video_rooms[room_id]:
                    recipient_ws = video_rooms[room_id][target_user_id]
                    try:
                        await recipient_ws.send_text(payload_to_send)
                        logger.info(f"Video Room {room_id}: Relayed {signal_type} from {user_id} to {target_user_id}")
                    except Exception as e:
                         logger.error(f"Video Room {room_id}: Error relaying {signal_type} to {target_user_id}: {e}")
                elif target_user_id:
                     logger.warning(f"Video Room {room_id}: Target user {target_user_id} for {signal_type} not found or not in room.")
                     # Optionally notify sender that target is not available
                     await websocket.send_text(json.dumps({"type": "error", "message": f"User {target_user_id} not found in room."}))
                else: # If no target_user_id, broadcast (e.g. some custom signals, though offer/answer/ICE are usually targeted)
                    logger.info(f"Video Room {room_id}: Broadcasting {signal_type} from {user_id} (no specific target).")
                    await broadcast_to_video_room(room_id, user_id, payload_to_send)

            elif signal_type == "hang-up":
                logger.info(f"Video Room {room_id}: User {user_id} initiated hang-up.")
                hangup_message = json.dumps({"type": "call-ended", "from_user_id": user_id})
                await broadcast_to_video_room(room_id, user_id, hangup_message)
                # Consider closing connections or cleaning up the room if all users hang up

            elif signal_type == "call-declined": # If a user explicitly declines
                logger.info(f"Video Room {room_id}: User {user_id} declined call.")
                decline_message = json.dumps({"type": "call-declined", "from_user_id": user_id})
                await broadcast_to_video_room(room_id, user_id, decline_message)


            # Add more signal types as needed (e.g., mute/unmute notifications)

    except WebSocketDisconnect:
        logger.info(f"Video User {user_id} disconnected from Room {room_id}.")
    finally:
        # Remove user from room and notify others
        if room_id in video_rooms and user_id in video_rooms[room_id]:
            del video_rooms[room_id][user_id]
            logger.info(f"Video User {user_id} removed from Room {room_id}.")

            leave_notification = json.dumps({"type": "user-left", "user_id": user_id})
            await broadcast_to_video_room(room_id, "system", leave_notification) # Send as system

            if not video_rooms[room_id]: # If room is empty, delete it
                del video_rooms[room_id]
                logger.info(f"Video Room {room_id} is now empty and removed.")

# To run this (from the fastapi_websocket_server directory):
# uvicorn main:app --reload --port 8001
# (assuming Django runs on 8000)
