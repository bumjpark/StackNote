from datetime import datetime
import pytz
import os
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import create_engine, MetaData

if os.getenv("TESTING") == "True":
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
# MYSQL_DATABASE_URL 환경변수가 없으면 로컬 SQLite 파일을 사용합니다. (개발 편의성 목적)
# 추후 배포 시에는 환경변수를 설정하여 MySQL을 사용해야 합니다.
database_url = os.getenv('MYSQL_DATABASE_URL')

if database_url:
    engine = create_engine(database_url)
else:
    # 임시 SQLite 데이터베이스 설정
    SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

meta = MetaData()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()