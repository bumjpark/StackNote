from fastapi import FastAPI
from app.routers import user

app = FastAPI(
    title="My FastAPI App",
    description="User API",
    version="1.0.0"
)
from app.database import engine
from app.models import Base

# DB 테이블 자동 생성 (개발 편의성 목적)
# 주의: 이 코드는 테이블이 없을 때만 생성합니다. 스키마 변경 시에는 Alembic 같은 마이그레이션 도구를 사용해야 합니다.
# 운영 환경에서는 이 코드를 제거하거나 마이그레이션 도구를 사용하는 것이 좋습니다.
Base.metadata.create_all(bind=engine)

# User 라우터 등록
app.include_router(
    user.router,
    prefix="/users"   # 👈 공통 URL
)