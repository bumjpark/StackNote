# StackNote

**StackNote**는 함께 소통하며 개발 일지를 기록할 수 있는 웹 애플리케이션입니다.  
FastAPI 기반 백엔드로 구성되어 있으며, **Docker Compose**를 통해 서버와 데이터베이스(MySQL)를 한 번에 실행할 수 있습니다.

## 🛠 기술 스택 (Tech Stack)

*   **Backend**: Python 3.11, FastAPI
*   **Database**: MySQL 8.0 (Docker)
*   **ORM**: SQLAlchemy
*   **Container**: Docker, Docker Compose

---

## 🚀 실행 방법 (Getting Started)

가장 권장하는 실행 방법은 **Docker**를 사용하는 것입니다.

### 1. 환경 변수 설정
`backend/.env` 파일을 수정하여 DB 접속 정보를 설정합니다.  
(이미 설정된 기본값이 있으므로 변경하지 않아도 바로 실행 가능합니다.)

```env
# backend/.env 예시
DB_USER=root
DB_PASSWORD=qwer5377~
DB_HOST=db       # Docker 서비스 이름
DB_PORT=3306
DB_NAME=stacknote
```

### 2. 도커 실행
프로젝트 루트 경로에서 다음 명령어를 입력합니다.

```bash
docker-compose up --build
```
*   **Backend**: `http://localhost:8000`
*   **API 문서**: `http://localhost:8000/docs`
*   **MySQL**: `localhost:3307` (외부 접속용 포트)

> **참고**: 처음 실행 시 MySQL 초기화로 인해 백엔드 연결이 1~2초 지연될 수 있으나, 자동 재시도 로직이 적용되어 있어 기다리면 정상적으로 연결됩니다.

---

## 📂 프로젝트 구조 (Project Structure)
불필요한 중복 파일을 제거하고 깔끔하게 통합했습니다.

```
StackNote/
├── docker-compose.yml       # 도커 실행 설정 파일
├── README.md                # 설명서
└── backend/
    ├── Dockerfile           # 백엔드 이미지 빌드 파일
    ├── requirements.txt     # 파이썬 의존성 패키지
    ├── .env                 # 환경 변수 (DB 정보)
    └── app/                 # 메인 소스 코드 폴더
        ├── main.py          # 앱 진입점 (DB 연결 재시도 로직 포함)
        ├── database.py      # DB 연결 설정 (Env 자동 감지)
        ├── models.py        # 통합된 모델 파일 (User, Report, Chatroom 등)
        ├── routers/         # API 라우터 (user, work_space)
        ├── crud/            # DB 처리 로직
        └── schemas/         # 데이터 검증(Pydantic) 스키마
```

## 📝 개발 진행 사항 (Progress)
*   ✅ **기본 환경 구축**: Docker, FastAPI, MySQL 연동 완료
*   ✅ **DB 연결 최적화**: `host.docker.internal` 이슈 해결 및 재시도(Retry) 로직 구현
*   ✅ **회원가입/로그인**: API 구현 및 테스트 완료
*   ✅ **파일 구조 통합**: `app/` 내부로 코드 통합 및 정리 완료
*   🚧 **통신 기능**: Report(페이지), Chatroom(채팅) 기능 구현 예정
