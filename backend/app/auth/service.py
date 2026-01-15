from .model import User
from .schema import UserPostRequest
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

def create_user (new_user: UserPostRequest, db: Session):
    user = User(
            email_id = new_user.email_id,
            pw = new_user.pw
    )
    db.add(user)
    db.commit()
    db.refresh(user)

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


        