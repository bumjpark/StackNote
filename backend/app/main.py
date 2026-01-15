from fastapi import FastAPI
from app.auth import router as user_router
from app.workspace import router as workspace_router
from app.core.database import engine, Base
from app.auth import model as auth_model
from app.workspace import model as workspace_model
from app.voice import model as voice_model

import time
import logging
from sqlalchemy.exc import OperationalError


app = FastAPI(
    title="My FastAPI App",
    description="User API",
    version="1.0.0"
)

# CORS 설정
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:5173", # Vite default port
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "*" # 개발 편의를 위해 모든 출처 허용 (배포 시 수정 필요)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
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
app.include_router(user_router.router, prefix="/users")
app.include_router(workspace_router.router)