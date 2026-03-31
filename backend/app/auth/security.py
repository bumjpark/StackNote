import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from passlib.context import CryptContext
import jwt
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# JWT 설정
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from shared.database.core.database import get_db
from shared.database.models.user import User
from sqlalchemy.orm import Session

# Argon2id 스킴 사용 (passlib는 기본적으로 Argon2id 타입 사용)
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    """토큰을 검증하고 현재 유저 객체를 반환하는 종속성입니다."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def hash_password(plain: str) -> str:
    """평문 비밀번호를 Argon2id 해시로 변환합니다."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """평문과 해시를 비교합니다. 평문인 경우도 안전하게 처리됩니다."""
    return pwd_context.verify(plain, hashed)


def is_plain_password(pw: str) -> bool:
    """저장된 pw가 해시가 아닌 평문인지 확인합니다."""
    # Argon2 해시는 항상 '$argon2' 접두사로 시작합니다
    return not pw.startswith("$argon2")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """JWT 액세스 토큰을 생성합니다."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
