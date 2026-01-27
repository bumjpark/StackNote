from fastapi import APIRouter, File, UploadFile, HTTPException
from pathlib import Path
import uuid
from typing import Optional

router = APIRouter(
    prefix="/pdf",
    tags=["PDF"]
)

# PDF 저장 디렉토리 설정
UPLOAD_DIR = Path("/app/uploads/pdfs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 허용된 파일 확장자
ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def validate_pdf_file(file: UploadFile) -> None:
    """PDF 파일 유효성 검사"""
    # 파일 확장자 확인
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"PDF 파일만 업로드 가능합니다. (현재: {file_ext})"
        )
    
    # Content-Type 확인
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail=f"올바른 PDF 파일이 아닙니다. (Content-Type: {file.content_type})"
        )


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: Optional[int] = None,
    workspace_id: Optional[int] = None
):
    """
    PDF 파일 업로드
    
    Args:
        file: 업로드할 PDF 파일
        user_id: 사용자 ID (선택)
        workspace_id: 워크스페이스 ID (선택)
    
    Returns:
        업로드된 파일 정보
    """
    try:
        # 파일 유효성 검사
        validate_pdf_file(file)
        
        # 고유한 파일명 생성 (UUID + 원본 파일명)
        file_id = str(uuid.uuid4())
        original_filename = file.filename
        safe_filename = f"{file_id}_{original_filename}"
        file_path = UPLOAD_DIR / safe_filename
        
        # 파일 크기 확인하면서 저장
        file_size = 0
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(8192):  # 8KB씩 읽기
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    # 파일 삭제 후 에러
                    buffer.close()
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"파일 크기가 너무 큽니다. (최대: {MAX_FILE_SIZE // (1024*1024)}MB)"
                    )
                buffer.write(chunk)
        
        # 응답 데이터
        return {
            "status": "success",
            "message": "PDF 파일이 성공적으로 업로드되었습니다.",
            "data": {
                "file_id": file_id,
                "filename": original_filename,
                "stored_filename": safe_filename,
                "file_size": file_size,
                "file_path": str(file_path),
                "user_id": user_id,
                "workspace_id": workspace_id
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # 에러 발생 시 업로드된 파일 삭제
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink(missing_ok=True)
        
        raise HTTPException(
            status_code=500,
            detail=f"파일 업로드 중 오류가 발생했습니다: {str(e)}"
        )
    finally:
        await file.close()


@router.get("/files")
async def list_files():
    """업로드된 PDF 파일 목록 조회"""
    try:
        files = []
        for file_path in UPLOAD_DIR.glob("*.pdf"):
            stat = file_path.stat()
            files.append({
                "filename": file_path.name,
                "size": stat.st_size,
                "created_at": stat.st_ctime
            })
        
        return {
            "status": "success",
            "count": len(files),
            "files": files
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"파일 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """업로드된 PDF 파일 삭제"""
    try:
        # file_id로 시작하는 파일 찾기
        matching_files = list(UPLOAD_DIR.glob(f"{file_id}_*"))
        
        if not matching_files:
            raise HTTPException(
                status_code=404,
                detail="파일을 찾을 수 없습니다."
            )
        
        # 파일 삭제
        for file_path in matching_files:
            file_path.unlink()
        
        return {
            "status": "success",
            "message": "파일이 성공적으로 삭제되었습니다.",
            "file_id": file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"파일 삭제 중 오류가 발생했습니다: {str(e)}"
        )
