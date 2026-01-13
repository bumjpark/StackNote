from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy.sql import func
import pytz
from app.database import Base

KST = pytz.timezone("Asia/Seoul")

# =========================
# User Model
# =========================
class User(Base):
    __tablename__ = 'user'
    
    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(String(50), nullable=False, unique=True)
    pw = Column(String(100), nullable=False)
    
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(KST))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(KST),
        onupdate=lambda: datetime.now(KST),
    )
    is_deleted = Column(Boolean, default=False)

    reports = relationship("Report", back_populates="user")
    chatrooms = relationship("Chatroom", secondary="chatroom_users", back_populates="users")
    messages = relationship("Message", back_populates="sender")
    workspaces = relationship("WorkSpace", back_populates="user")


# =========================
# Communication Models (New)
# =========================
class Report(Base):
    __tablename__ = "report"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=True) # Markdown content
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    updated_at = Column(DateTime, default=lambda: datetime.now(KST), onupdate=lambda: datetime.now(KST))
    
    user = relationship("User", back_populates="reports")

class Chatroom(Base):
    __tablename__ = "chatroom"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    
    users = relationship("User", secondary="chatroom_users", back_populates="chatrooms")
    messages = relationship("Message", back_populates="chatroom")

class ChatroomUsers(Base):
    __tablename__ = "chatroom_users"
    chatroom_id = Column(Integer, ForeignKey("chatroom.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), primary_key=True)

class Message(Base):
    __tablename__ = "message"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    sender_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    chatroom_id = Column(Integer, ForeignKey("chatroom.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))

    sender = relationship("User", back_populates="messages")
    chatroom = relationship("Chatroom", back_populates="messages")


# =========================
# WorkSpace Models (From Remote)
# =========================
class WorkSpace(Base):
    __tablename__ = "work_space"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    page_type = Column(String(10), nullable=False)
    work_space_name = Column(String(10), nullable=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    user = relationship("User", back_populates="workspaces")


class Page(Base):
    __tablename__ = "page_list"

    id = Column(String(10), primary_key=True)
    workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    page_name = Column(String(10), nullable=False)

class Block(Base):
    __tablename__ = "block_list"

    id = Column(String(10), primary_key=True)
    page_id = Column(String(10), ForeignKey("page_list.id"), nullable=False)
    workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    block_content = Column(Text, nullable=False)

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
