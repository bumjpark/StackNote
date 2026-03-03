from fastapi import FastAPI, UploadFile, File, HTTPException
import asyncio
import concurrent.futures
import shutil
import os
import tempfile
from app.processor import PDFProcessor

app = FastAPI(title="StackNote PDF Backend", version="1.0.0")

# 이미지 저장을 위한 공유 볼륨 경로
UPLOAD_DIR = "/app/uploads"

# 로깅 설정 (파일 및 콘솔 출력)
import logging
log_file_path = os.path.join(UPLOAD_DIR, "pdf_backend_debug.log")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(), # 콘솔 출력
        logging.FileHandler(log_file_path, mode='a', encoding='utf-8') # 파일 출력
    ]
)
logger = logging.getLogger(__name__)

processor = PDFProcessor(upload_dir=UPLOAD_DIR)

# 동시 실행 제한을 위한 플래그
is_processing = False

@app.get("/status")
def get_status():
    """
    현재 PDF 처리 상태 반환
    True: 처리 중 / False: 대기 가능
    """
    return {"is_processing": is_processing}

@app.get("/")
def read_root():
    return {"status": "ok", "service": "pdf-backend"}

@app.post("/analyze")
async def analyze_pdf(file: UploadFile = File(...)):
    """
    PDF 파일을 받아 분석하고 구문 분석된 블록 데이터를 반환합니다.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    global is_processing
    
    # [Debug] 요청 수신 확인
    logger.info(f"🔒 Request received. Current is_processing: {is_processing}")

    if is_processing:
        logger.warning("❌ Blocked: Analysis in progress")
        # 이미 처리 중이면 423 Locked 반환
        raise HTTPException(
            status_code=423, 
            detail={
                "message": "현재 다른 PDF 작업을 실행 중입니다. 작업이 완료되면 알려드리겠습니다.",
                "code": "loked"
            }
        )
    
    # 플래그 설정
    is_processing = True
    logger.info("✅ Lock acquired. Starting processing...")

    # 임시 파일로 저장
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        shutil.copyfileobj(file.file, tmp_file)
        tmp_path = tmp_file.name
        logger.info(f"📁 Temp file saved at: {tmp_path}")

    try:
        # 프로세서 실행 (스레드 풀에서 실행하여 이벤트 루프 차단 방지)
        loop = asyncio.get_running_loop()
        logger.info("🚀 Starting PDFProcessor...")
        
        # run_in_executor의 첫 인자가 None이면 기본 executor 사용
        result = await loop.run_in_executor(None, processor.process_pdf, tmp_path)
        
        logger.info("✅ Processing completed successfully.")
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"❌ Error during processing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF processing failed: {str(e)}")
        
    finally:
        # 임시 파일 삭제
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            logger.info("🗑️ Temp file removed.")
            
        # 플래그 해제
        is_processing = False
        logger.info("🔓 Lock released.")
        

