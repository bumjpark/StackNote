from fastapi import FastAPI
<<<<<<< Updated upstream
from app.routers import user
=======
from app.auth import router as user_router
from app.workspace import router as workspace_router
>>>>>>> Stashed changes

app = FastAPI(
    title="My FastAPI App",
    description="User API",
    version="1.0.0"
)
from app.core.database import engine, Base
from app.auth import model as auth_model
from app.workspace import model as workspace_model
from app.voice import model as voice_model

# DB 테이블 자동 생성 (개발 편의성 목적)
# 주의: 이 코드는 테이블이 없을 때만 생성합니다. 스키마 변경 시에는 Alembic 같은 마이그레이션 도구를 사용해야 합니다.
# 운영 환경에서는 이 코드를 제거하거나 마이그레이션 도구를 사용하는 것이 좋습니다.
Base.metadata.create_all(bind=engine)

<<<<<<< Updated upstream
# User 라우터 등록
app.include_router(
    user.router,
    prefix="/users"   # 👈 공통 URL
)
=======
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
>>>>>>> Stashed changes
