from fastapi import FastAPI
from app.routers import user, work_space

app = FastAPI(
    title="My FastAPI App",
    description="User API",
    version="1.0.0"
)
from app.database import engine
from app.models import Base

import time
import logging
from sqlalchemy.exc import OperationalError

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# DB 테이블 생성 (재시도 로직 포함)
MAX_RETRIES = 30  # 최대 30회 시도
RETRY_DELAY = 2   # 2초 대기

for i in range(MAX_RETRIES):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database connected and tables created!")
        break
    except OperationalError as e:
        if i == MAX_RETRIES - 1:
            logger.error(f"❌ Failed to connect to database after {MAX_RETRIES} attempts.")
            raise e
        logger.warning(f"⚠️ Database not ready (Attempt {i+1}/{MAX_RETRIES}). Retrying in {RETRY_DELAY}s...")
        time.sleep(RETRY_DELAY)

# 라우터 등록
app.include_router(user.router, prefix="/users")
app.include_router(work_space.router)