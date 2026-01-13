from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship,declarative_base
from datetime import datetime
import pytz

# 기본 클래스 생성
Base = declarative_base()
KST = pytz.timezone("Asia/Seoul")

# 테이블 매핑
class User(Base):
    __tablename__ = 'user'  # 테이블 이름
    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(String(10), nullable=False, unique=True)
    pw = Column(String(20), nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(KST))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(KST),
        onupdate=lambda: datetime.now(KST),
    )
    is_deleted = Column(Boolean, default=False)


    # 설계도 자체가 아직 구현되지 않아서 오류가 나서 임시로 주석처리, 추후 기능 구현되면 주석 해제
    # reports = relationship("Report", back_populates="user")
    # chatrooms = relationship("Chatroom", back_populates="user")
