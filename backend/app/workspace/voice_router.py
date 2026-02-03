from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List
from sqlalchemy.orm import Session

from shared.database.core.database import get_db
from shared.database.models.workspace import VoiceChat
from . import service

router = APIRouter(
    prefix="/voice",
    tags=["Voice Chat"]
)

@router.get("/{channel_id}/history")
def get_voice_chat_history(
    channel_id: str,
    db: Session = Depends(get_db)
):
    """
    특정 음성 채널의 채팅 내역을 조회합니다.
    """
    history = service.get_voice_chat_history(db, channel_id)
    return {"status": "success", "history": history}

@router.post("/{channel_id}/chat")
def save_voice_chat(
    channel_id: str,
    user_id: int = Body(..., embed=True),
    content: str = Body(..., embed=True),
    id: str = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """
    음성 채팅 내역을 저장합니다.
    """
    chat = service.save_voice_chat(db, channel_id, user_id, content, chat_id=id)
    return {"status": "success", "chat_id": chat.id}
@router.delete("/chat/{chat_id}")
def delete_voice_chat(
    chat_id: str,
    db: Session = Depends(get_db)
):
    """
    음성 채팅 내역을 삭제합니다.
    """
    success = service.delete_voice_chat(db, chat_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat message not found")
    return {"status": "success"}
