from typing import Optional
from pydantic import BaseModel, constr, field_validator


class UserPostRequest(BaseModel):
    email_id: constr(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")  # basic email format
    pw: constr(min_length=8, max_length=32)
    nickname: Optional[constr(min_length=2, max_length=20, pattern=r"^[a-zA-Z0-9가-힣_]+$")] = None

    @field_validator("pw")
    def validate_password(cls, value: str) -> str:
        has_letter = any(ch.isalpha() for ch in value)
        has_number = any(ch.isdigit() for ch in value)
        if not (has_letter and has_number):
            raise ValueError("Password must include at least one letter and one number")
        return value

class UserLoginRequest(BaseModel):
    email_id: str
    pw: str

class UserLoginResponse(BaseModel):
    id: int

# 사용자 입력 모델
class UserInput(BaseModel):
    message: str

class UserCheckEmailRequest(BaseModel):
    email_id: str
