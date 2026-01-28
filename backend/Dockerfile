FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 설치 (필요시 추가)
# RUN apt-get update && apt-get install -y ...

# 의존성 파일 복사 및 설치
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY backend .
COPY shared ./shared

# 포트 노출
EXPOSE 8000

# 서버 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
