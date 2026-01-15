from fastapi import FastAPI
from app.auth import router as user_router
from app.workspace import router as workspace_router
from app.core.database import engine, Base
import time
import logging
from sqlalchemy.exc import OperationalError

app = FastAPI(
    title="My FastAPI App",
    description="Backend API with SQLAlchemy + Pydantic v2",
    version="1.0.0"
)

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# DB 테이블 생성 (재시도 로직 포함)
MAX_RETRIES = 30  # 최대 30회 시도
RETRY_DELAY = 2   # 2초 대기

def wait_for_db():
    retries = 0
    while retries < MAX_RETRIES:
        try:
            # DB 연결 시도 (메타데이터 생성으로 확인)
            Base.metadata.create_all(bind=engine)
            logger.info("✅ Database connected and tables created!")
            return
        except OperationalError as e:
            retries += 1
            logger.warning(f"⚠️ Database not ready yet (Attempt {retries}/{MAX_RETRIES}). Error: {e}")
            time.sleep(RETRY_DELAY)
        except Exception as e:
            logger.error(f"❌ Unexpected error connecting to DB: {e}")
            time.sleep(RETRY_DELAY)
            retries += 1
            
    logger.error("❌ Could not connect to database after maximum retries.")
    raise RuntimeError("Database connection failed")

# 앱 시작 시 DB 연결 대기 및 테이블 생성 실행
wait_for_db()

# 라우터 등록
app.include_router(user_router.router, prefix="/users")
app.include_router(workspace_router.router)
