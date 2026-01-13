# StackNote

**StackNote**는 함께 소통하며 개발 일지를 기록할 수 있는 웹 애플리케이션입니다.
FastAPI 기반의 백엔드로 구성되어 있으며, 로컬 개발 환경과 도커(Docker) 환경을 모두 지원합니다.

## 🛠 기술 스택 (Tech Stack)
- **Backend**: Python 3.11, FastAPI
- **Database**: 
  - **Local**: SQLite (자동 설정)
  - **Production**: MySQL (환경변수 설정 시)
- **ORM**: SQLAlchemy
- **Container**: Docker, Docker Compose

## 🚀 실행 방법 (Getting Started)

### 1. 도커(Docker)로 실행하기 (권장)
가장 간편한 방법입니다. PC에 Docker가 설치되어 있어야 합니다.

```bash
docker-compose up --build
```
- 서버 주소: `http://localhost:8000`
- API 문서(Swagger): `http://localhost:8000/docs`

### 2. 로컬에서 직접 실행하기
Python 3.11 이상이 필요합니다.

```bash
# 1. 가상환경 생성 및 실행
python3 -m venv backend/venv
source backend/venv/bin/activate  # Windows: backend\venv\Scripts\activate

# 2. 의존성 설치
pip install -r backend/requirements.txt

# 3. 서버 실행 (backend 폴더로 이동 후)
cd backend
uvicorn app.main:app --reload
```

## 📝 주요 API (Endpoints)
- **회원가입**: `POST /users/signup`
- **로그인**: `POST /users/login`
- **유저 조회**: `GET /users/{id}`
- **유저 탈퇴**: `DELETE /users/{id}`

## ⚙️ 환경 변수 (Configuration)
기본적으로 설정 없이도 임시 DB(SQLite)로 동작합니다.
MySQL을 연결하려면 `backend/.env` 파일을 생성하세요. (참고: `backend/.env.example`)

```env
MYSQL_DATABASE_URL="mysql+pymysql://user:password@localhost:3306/dbname"
```
