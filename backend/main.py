from fastapi import FastAPI

from database import engine
from models import User, WorkSpace, Page, Block, VoiceChat
from app.routers.work_space import router as workspace_router

app = FastAPI()

# 테이블 생성 (개발 단계에서만)
User.metadata.create_all(bind=engine)
WorkSpace.metadata.create_all(bind=engine)
Page.metadata.create_all(bind=engine)
Block.metadata.create_all(bind=engine)
VoiceChat.metadata.create_all(bind=engine)

app.include_router(workspace_router)