from fastapi import FastAPI
from routers import user

app = FastAPI(
    title="My FastAPI App",
    description="User API",
    version="1.0.0"
)

# User 라우터 등록
app.include_router(
    user.router,
    prefix="/users"   # 👈 공통 URL
)