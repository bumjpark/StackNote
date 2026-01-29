from fastapi import APIRouter ,Depends, HTTPException
from shared.schemas.auth import UserPostRequest, UserLoginRequest, UserLoginResponse, UserCheckEmailRequest
from . import service as UserServices
from sqlalchemy.orm import Session
from shared.database.core.database import get_db

router = APIRouter()

@router.post("/signup",description="유저 회원가입", tags=["Users"])
def post_user(new_user:UserPostRequest, db : Session = Depends(get_db)):
    response = UserServices.create_user(new_user,db)
    return response

@router.get("/{user_id}",description="유저 정보 조회", tags=["Users"])
def get_user(user_id : int, db : Session = Depends(get_db)):
    response = UserServices.find_user(user_id,db)
    return response

@router.post("/login",description="유저 로그인", tags=["Users"])
def login_user(login_data:UserLoginRequest, db : Session = Depends(get_db)):
    response = UserServices.login_user(login_data.email_id, login_data.pw, db)
    return response

@router.delete("/{user_id}",description="유저 탈퇴", tags=["Users"])
def delete_user(user_id : int, db : Session = Depends(get_db)):
    response = UserServices.delete_user(user_id=user_id, db=db)
    return response

@router.post("/check_email", description="이메일 가입 여부 확인", tags=["Users"])
def check_email(data: UserCheckEmailRequest, db: Session = Depends(get_db)):
    response = UserServices.check_email_exists(data.email_id, db)
    return response