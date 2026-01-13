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
else:
    engine = create_engine(os.getenv('MYSQL_DATABASE_URL'))

meta = MetaData()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()