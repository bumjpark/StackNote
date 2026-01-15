from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base

class VoiceChat(Base):
    __tablename__ = "voice_chat_table"

    id = Column(String(10), primary_key=True)
    workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    chat_content = Column(Text, nullable=False)
