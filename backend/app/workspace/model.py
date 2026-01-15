from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import pytz
from app.core.database import Base

KST = pytz.timezone("Asia/Seoul")

# =========================
# WorkSpace Models
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
    
    user = relationship("app.auth.model.User", back_populates="workspaces")


class Page(Base):
    __tablename__ = "page_list"

    id = Column(String(50), primary_key=True)
    workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    page_name = Column(String(100), nullable=False)

class Block(Base):
    __tablename__ = "block_list"

    id = Column(String(50), primary_key=True)
    page_id = Column(String(50), ForeignKey("page_list.id"), nullable=False)
    workspace_id = Column(Integer, ForeignKey("work_space.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    block_type = Column(String(50), nullable=False) # text, h1, h2, image, etc.
    content = Column(JSON, nullable=True) # {"text": "Hello", "checked": false, ...}
    order = Column(Float, nullable=False, index=True) # Lexical order (e.g., 1.0, 1.5, 2.0)
    parent_id = Column(String(50), ForeignKey("block_list.id"), nullable=True) # For nested blocks
    
    # Relationships
    parent = relationship("Block", remote_side=[id], backref="children")

# =========================
# Communication Models (Consolidated here for now)
# =========================
class Report(Base):
    __tablename__ = "report"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=True) # Markdown content
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    updated_at = Column(DateTime, default=lambda: datetime.now(KST), onupdate=lambda: datetime.now(KST))
    
    user = relationship("app.auth.model.User", back_populates="reports")

class Chatroom(Base):
    __tablename__ = "chatroom"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    
    users = relationship("app.auth.model.User", secondary="chatroom_users", back_populates="chatrooms")
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

    sender = relationship("app.auth.model.User", back_populates="messages")
    chatroom = relationship("Chatroom", back_populates="messages")
