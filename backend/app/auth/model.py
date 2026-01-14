from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import pytz
from app.core.database import Base

KST = pytz.timezone("Asia/Seoul")

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

    reports = relationship("app.workspace.model.Report", back_populates="user")
    chatrooms = relationship("app.workspace.model.Chatroom", secondary="chatroom_users", back_populates="users")
    messages = relationship("app.workspace.model.Message", back_populates="sender")
    workspaces = relationship("app.workspace.model.WorkSpace", back_populates="user")
