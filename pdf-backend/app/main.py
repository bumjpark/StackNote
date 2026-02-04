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
processor = PDFProcessor(upload_dir=UPLOAD_DIR)

# 동시 실행 제한을 위한 세마포어 (1개만 허용)
# 423 Locked 에러를 반환하기 위해 세마포어를 직접 획득 시도하는 로직 사용
sem = asyncio.Semaphore(1)
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
    
    if is_processing:
        # 이미 처리 중이면 423 Locked 반환
        raise HTTPException(
            status_code=423, 
            detail={
                "message": "현재 다른 PDF 작업을 실행 중입니다. 작업이 완료되면 알려드리겠습니다.",
                "code": "loked"
            }
        )

    # 임시 파일로 저장
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        shutil.copyfileobj(file.file, tmp_file)
        tmp_path = tmp_file.name
        
    global is_processing
    lock_acquired = False

    try:
        # 락 획득 시도
        if not sem.locked():
             await sem.acquire()
             lock_acquired = True
             is_processing = True
        else:
             raise HTTPException(status_code=423, detail="Server is busy")
             
        # 프로세서 실행 (스레드 풀에서 실행하여 이벤트 루프 차단 방지)
        loop = asyncio.get_running_loop()
        # run_in_executor의 첫 인자가 None이면 기본 executor 사용
        result = await loop.run_in_executor(None, processor.process_pdf, tmp_path)
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF processing failed: {str(e)}")
        
    finally:
        # 임시 파일 삭제
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            
        # 락 해제 (내가 획득했을 때만 해제)
        if lock_acquired:
            sem.release()
            is_processing = False
        

