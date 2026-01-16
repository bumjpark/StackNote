from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
import json
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="StackNote Voice Backend",
    description="Signaling Server for P2P Voice Chat",
    version="0.2.0"
)

# CORS 설정 (프론트엔드/로컬 파일 접근 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 출처 허용 (보안상 실제 배포 시에는 특정 도메인으로 제한 필요)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
# Connection Manager
# ==========================
class ConnectionManager:
    def __init__(self):
        # 방 ID -> { 유저 ID: WebSocket }
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        # 방 ID -> { 유저 ID: username }
        self.usernames: Dict[str, Dict[str, str]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        if room_id not in self.usernames:
            self.usernames[room_id] = {}
        
        self.rooms[room_id][user_id] = websocket
        logger.info(f"User {user_id} connected to Room {room_id}")
        
        # 방에 있는 다른 사람들에게 입장 알림
        await self.broadcast_to_room(
            {
                "type": "user_joined",
                "user_id": user_id,
                "msg": f"User {user_id} joined room {room_id}"
            },
            room_id,
            exclude_user=user_id
        )

    def disconnect(self, room_id: str, user_id: str):
        if room_id in self.rooms:
            if user_id in self.rooms[room_id]:
                del self.rooms[room_id][user_id]
                logger.info(f"User {user_id} disconnected from Room {room_id}")
            
            # username도 삭제
            if room_id in self.usernames and user_id in self.usernames[room_id]:
                del self.usernames[room_id][user_id]
            
            # 방이 비었으면 삭제
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            if room_id in self.usernames and not self.usernames[room_id]:
                del self.usernames[room_id]

    async def broadcast_to_room(self, message: dict, room_id: str, exclude_user: str = None):
        """방에 있는 모든(또는 특정 유저 제외) 유저에게 메시지 전송"""
        if room_id in self.rooms:
            for user_id, connection in self.rooms[room_id].items():
                if user_id != exclude_user:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        logger.error(f"Failed to send to {user_id}: {e}")

    async def send_personal_message(self, message: dict, room_id: str, target_user_id: str):
        """특정 유저에게 귓속말 (Signaling Data 전달용)"""
        if room_id in self.rooms and target_user_id in self.rooms[room_id]:
            connection = self.rooms[room_id][target_user_id]
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send personal message to {target_user_id}: {e}")

manager = ConnectionManager()

@app.get("/")
def health_check():
    return {"status": "ok", "service": "voice-backend-signaling"}

@app.get("/active_users")
def get_active_users():
    """Return active users in each voice channel with usernames"""
    result = {}
    for room_id, users in manager.rooms.items():
        result[room_id] = [
            {
                "user_id": user_id,
                "username": manager.usernames.get(room_id, {}).get(user_id, user_id)
            }
            for user_id in users.keys()
        ]
    return result

@app.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    await manager.connect(websocket, room_id, user_id)
    try:
        while True:
            # 클라이언트로부터 시그널링 데이터 수신 (Offer, Answer, ICE Candidate)
            data = await websocket.receive_json()
            logger.info(f"Received signal from {user_id} in {room_id}: {data.get('type')}")
            
            # Handle identify message to store username
            if data.get("type") == "identify":
                username = data.get("username", user_id)
                if room_id not in manager.usernames:
                    manager.usernames[room_id] = {}
                manager.usernames[room_id][user_id] = username
                logger.info(f"User {user_id} identified as {username} in room {room_id}")
            
            target_user = data.get("target_user_id")
            
            # 1. 특정 대상에게 보내는 메시지 (Offer, Answer, ICE Candidate)
            if target_user:
                # 발신자 ID를 추가해서 전달 (누가 보냈는지 알아야 답장을 하니까)
                data["sender_user_id"] = user_id
                await manager.send_personal_message(data, room_id, target_user)
            
            # 2. 방 전체 메시지 (채팅 등 - 현재는 주로 1번만 사용됨)
            else:
                await manager.broadcast_to_room(data, room_id, exclude_user=user_id)

    except WebSocketDisconnect:
        manager.disconnect(room_id, user_id)
        # 퇴장 알림
        await manager.broadcast_to_room(
            {
                "type": "user_left",
                "user_id": user_id
            },
            room_id
        )
    except Exception as e:
        logger.error(f"Error: {e}")
        manager.disconnect(room_id, user_id)
