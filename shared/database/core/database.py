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

# 개별 환경변수 확인 (DB_USER, DB_PASSWORD 등)
if not database_url:
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT", "3306")
    db_name = os.getenv("DB_NAME")

    if db_user and db_password and db_host and db_name:
        database_url = f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"

if database_url:
    engine = create_engine(database_url, pool_pre_ping=True)
else:
    # 임시 SQLite 데이터베이스 설정
    SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

meta = MetaData()
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
