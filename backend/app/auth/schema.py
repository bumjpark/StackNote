from pydantic import BaseModel


class UserPostRequest(BaseModel):
    email_id: str
    pw: str

class UserLoginRequest(UserPostRequest):
    pass

class UserLoginResponse(BaseModel):
    id: int

# 사용자 입력 모델
class UserInput(BaseModel):
    message: str

class UserCheckEmailRequest(BaseModel):
    email_id: str