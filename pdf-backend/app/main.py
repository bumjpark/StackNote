from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import os
import tempfile
from app.processor import PDFProcessor

app = FastAPI(title="StackNote PDF Backend", version="1.0.0")

# 이미지 저장을 위한 공유 볼륨 경로
UPLOAD_DIR = "/app/uploads"
processor = PDFProcessor(upload_dir=UPLOAD_DIR)

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
    
    # 임시 파일로 저장
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        shutil.copyfileobj(file.file, tmp_file)
        tmp_path = tmp_file.name
        
    try:
        # 프로세서 실행
        result = processor.process_pdf(tmp_path)
        return result
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF processing failed: {str(e)}")
        
    finally:
        # 임시 파일 삭제
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
