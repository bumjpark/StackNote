from shared.database.models.user import User
from shared.schemas.auth import UserPostRequest
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from app.workspace import service as WorkspaceService
from shared.schemas.workspace import WorkspaceRequest

def create_user (new_user: UserPostRequest, db: Session):
    user = User(
            email_id = new_user.email_id,
            pw = new_user.pw
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 기본 워크스페이스 생성
    workspace_req = WorkspaceRequest(
        user_id=user.id,
        page_type="private", # Default type, logic handles classification
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


def find_user(user_id :int ,db :Session)  :
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user.email_id

def login_user(email_id: str, pw: str, db: Session):
    user = db.query(User).filter(User.email_id == email_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="The email_id doesn't exist")

    if user.pw != pw:
        raise HTTPException(status_code=400, detail="The pw is not correct")

    return {"status": "success", "message": "Successfully logged in", "user_id": user.id}

def delete_user(user_id :int, db :Session):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_deleted:
        raise HTTPException(status_code=400, detail="User already deleted")
    
    user.is_deleted = True
    user.updated_at = datetime.now()

    db.commit()

    return{"status": "success", "message": "User deleted successfully"}

def check_email_exists(email_id: str, db: Session):
    user = db.query(User).filter(User.email_id == email_id).first()
    if user:
        return {"status": "exists", "message": "Email already registered", "exists": True}
    return {"status": "available", "message": "Email is available", "exists": False}


        