from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import pytz
import uuid
from shared.database.core.database import Base

KST = pytz.timezone("Asia/Seoul")

# =========================
# WorkSpace Model: 워크스페이스 정보를 저장하는 테이블
# =========================
class WorkSpace(Base):
    __tablename__ = "work_space"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    work_space_name = Column(String(100), nullable=False)


    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    user = relationship("shared.database.models.user.User", back_populates="workspaces")
    
    # Relationship for team members (Many-to-Many)
    members = relationship(
        "shared.database.models.user.User",
        secondary="workspace_members",
        back_populates="shared_workspaces"
    )


# =========================
# WorkspaceMember Model: 워크스페이스별 소속 멤버와 권한을 관리하는 테이블
# =========================
class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    
    workspace_id = Column(Integer, ForeignKey("work_space.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), primary_key=True)
    role = Column(String(20), default="member") # 'admin', 'member'
    status = Column(String(20), default="pending") # 'pending', 'accepted', 'declined'
    joined_at = Column(DateTime, default=lambda: datetime.now(KST))


# =========================
# PageMember Model: 페이지별 독립적인 멤버 초대 및 권한을 관리하는 테이블
# =========================
class PageMember(Base):
    __tablename__ = "page_members"
    
    page_id = Column(String(50), ForeignKey("page_list.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), primary_key=True)
    role = Column(String(20), default="member") # 'admin', 'member'
    status = Column(String(20), default="pending") # 'pending', 'accepted', 'declined'
    target_workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=True)
    joined_at = Column(DateTime, default=lambda: datetime.now(KST))


# =========================
# Page Model: 워크스페이스 내의 개별 페이지 정보를 저장하는 테이블
# =========================
class Page(Base):
    __tablename__ = "page_list"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    page_name = Column(String(50), nullable=False)
    page_type = Column(String(20), nullable=True)
    icon = Column(String(10), nullable=True, default="📄")  


# =========================
# VoiceChannel Model: 보이스 채널(방) 정보를 저장하는 테이블
# =========================
class VoiceChannel(Base):
    __tablename__ = "voice_channel"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=True) # Optional now
    page_id = Column(String(50), ForeignKey("page_list.id"), nullable=True) # [NEW] Linked to a specific page
    name = Column(String(100), nullable=False)
    
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

# Block class removed to avoid conflict with app.models.ContentBlock
# class Block(Base):
#     __tablename__ = "block_list"
# ...

# =========================
# Report Model: 사용자 리포트 정보를 저장하는 테이블
# =========================
class Report(Base):
    __tablename__ = "report"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=True) # Markdown content
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    updated_at = Column(DateTime, default=lambda: datetime.now(KST), onupdate=lambda: datetime.now(KST))
    
    user = relationship("shared.database.models.user.User", back_populates="reports")

# =========================
# Chatroom Model: 채팅방 정보를 저장하는 테이블
# =========================
class Chatroom(Base):
    __tablename__ = "chatroom"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    
    users = relationship("shared.database.models.user.User", secondary="chatroom_users", back_populates="chatrooms")
    messages = relationship("Message", back_populates="chatroom")

# =========================
# ChatroomUsers Model: 유저와 채팅방 간의 다대다 관계를 매핑하는 테이블
# =========================
class ChatroomUsers(Base):
    __tablename__ = "chatroom_users"
    chatroom_id = Column(Integer, ForeignKey("chatroom.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), primary_key=True)

# =========================
# Message Model: 채팅 메시지 내용을 저장하는 테이블
# =========================
class Message(Base):
    __tablename__ = "message"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    sender_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    chatroom_id = Column(Integer, ForeignKey("chatroom.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))

    sender = relationship("shared.database.models.user.User", back_populates="messages")
    chatroom = relationship("Chatroom", back_populates="messages")

# =========================
# ContentBlock Model: 페이지 내의 블록 기반 컨텐츠(BlockNote)를 저장하는 테이블
# =========================
class ContentBlock(Base):
    __tablename__ = "block_list"
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True)  # UUID
    page_id = Column(String(50), ForeignKey("page_list.id"), nullable=False)
    parent_id = Column(String(36), nullable=True) # Parent block ID
    
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

# =========================
# VoiceChat Model: 보이스 채팅 내역 및 관련 데이터를 저장하는 테이블
# =========================
class VoiceChat(Base):
    __tablename__ = "voice_chat_table"
    __table_args__ = {'extend_existing': True}

    id = Column(String(10), primary_key=True)
    workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=True)
    page_id = Column(String(50), ForeignKey("page_list.id"), nullable=True) # [NEW]
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    chat_content = Column(Text, nullable=False)
