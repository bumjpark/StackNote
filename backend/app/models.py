from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import pytz
from app.core.database import Base

KST = pytz.timezone("Asia/Seoul")

# ContentBlock (formerly Block) - Defined only here
class ContentBlock(Base):
    __tablename__ = "block_list"
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True)  # UUID
    page_id = Column(String(50), ForeignKey("page_list.id"), nullable=False)
    
    # BlockNote specific fields
    type = Column(String(50), nullable=False) # paragraph, heading, etc.
    props = Column(JSON, nullable=True)       # JSON properties (textColor, etc.)
    content = Column(JSON, nullable=True)     # Inline content (text, heavy, etc.)
    children_ids = Column(JSON, nullable=True) # List of children block IDs
    
    # Optional: For ordering (Linked List approach or Index based)
    prev_block_id = Column(String(36), nullable=True)
    next_block_id = Column(String(36), nullable=True)

    # Metadata
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

# VoiceChat - Defined only here
class VoiceChat(Base):
    __tablename__ = "voice_chat_table"
    __table_args__ = {'extend_existing': True}

    id = Column(String(10), primary_key=True)
    workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    chat_content = Column(Text, nullable=False)
