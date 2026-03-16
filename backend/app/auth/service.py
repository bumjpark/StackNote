from shared.database.models.user import User
from shared.schemas.auth import UserPostRequest
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from app.workspace import service as WorkspaceService
from shared.schemas.workspace import WorkspaceRequest
from app.auth.security import hash_password, verify_password, is_plain_password, create_access_token


def create_user(new_user: UserPostRequest, db: Session):
    existing_user = db.query(User).filter(User.email_id == new_user.email_id).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")

    nickname = new_user.nickname or new_user.email_id.split("@")[0]
    user = User(
            email_id=new_user.email_id,
            pw=hash_password(new_user.pw),  # Argon2id 해시로 저장
            nickname=nickname
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 기본 워크스페이스 생성
    workspace_req = WorkspaceRequest(
        user_id=user.id,
        page_type="private",  # Default type, logic handles classification
        work_space_name="My Workspace"
    )

    workspace = WorkspaceService.create_workspace(db, workspace_req)

    # 기본 페이지 생성
    WorkspaceService.create_default_pages(
        db=db,
        workspace_id=workspace.id,
        user_id=user.id
    )

    return user


def find_user(user_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user.email_id


def login_user(email_id: str, pw: str, db: Session):
    user = db.query(User).filter(User.email_id == email_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="The email_id doesn't exist")

    # 평문 비밀번호 자동 업그레이드 (기존 평문 계정 마이그레이션)
    if is_plain_password(user.pw):
        if user.pw != pw:
            raise HTTPException(status_code=400, detail="The pw is not correct")
        # 로그인 성공 → 즉시 Argon2id 해시로 업그레이드
        user.pw = hash_password(pw)
        user.updated_at = datetime.now()
        db.commit()
    else:
        # 이미 해시된 비밀번호 검증
        if not verify_password(pw, user.pw):
            raise HTTPException(status_code=400, detail="The pw is not correct")

    return {
        "status": "success",
        "message": "Successfully logged in",
        "user_id": user.id,
        "id": user.id,
        "nickname": user.nickname or user.email_id.split("@")[0],
        "access_token": create_access_token(data={"sub": str(user.id)}),
        "token_type": "bearer",
    }


def delete_user(user_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_deleted:
        raise HTTPException(status_code=400, detail="User already deleted")

    user.is_deleted = True
    user.updated_at = datetime.now()

    db.commit()

    return {"status": "success", "message": "User deleted successfully"}


def check_email_exists(email_id: str, db: Session):
    user = db.query(User).filter(User.email_id == email_id).first()
    if user:
        return {"status": "exists", "message": "Email already registered", "exists": True}
    return {"status": "available", "message": "Email is available", "exists": False}
