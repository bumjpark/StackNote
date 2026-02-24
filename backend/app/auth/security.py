from passlib.context import CryptContext

# Argon2id 스킴 사용 (passlib는 기본적으로 Argon2id 타입 사용)
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
)


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
