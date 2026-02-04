
import httpx
import json
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from shared.database.models.workspace import Page, ContentBlock
from shared.schemas.block import BlockCreate

# PDF Backend URL (Docker Compose Service Name)
PDF_BACKEND_URL = "http://pdf-backend:8000"

import logging
import os

# 로깅 설정
UPLOAD_DIR = "/app/uploads"
log_file_path = os.path.join(UPLOAD_DIR, "main_backend_pdf.log")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(log_file_path, mode='a', encoding='utf-8')
    ]
)
logger = logging.getLogger("pdf_service")

async def process_pdf_upload(db: Session, workspace_id: int, user_id: int, file: UploadFile):
    """
    1. PDF 파일을 pdf-backend로 전송하여 분석 요청
    2. 분석된 결과를 바탕으로 새 Page 생성
    3. Block 생성 및 저장
    """
    
    # 1. pdf-backend 호출
    logger.info(f"📡 Sending PDF to {PDF_BACKEND_URL}...")
    
    async with httpx.AsyncClient(timeout=6000.0) as client:
        # 파일 스트림을 그대로 전달
        files = {"file": (file.filename, file.file, file.content_type)}
        try:
            response = await client.post(f"{PDF_BACKEND_URL}/analyze", files=files)
            response.raise_for_status()
            result = response.json()
            logger.info("✅ Received response from PDF backend")
        except httpx.RequestError as e:
            logger.error(f"❌ Connection error: {e}")
            raise HTTPException(status_code=503, detail="PDF analysis service unavailable")
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ API error: {e.response.text}")
            if e.response.status_code == 423:
                 raise HTTPException(status_code=423, detail="PDF Backend is busy")
            raise HTTPException(status_code=e.response.status_code, detail="PDF analysis failed")

async def check_pdf_status():
    """
    PDF Backend의 상태를 확인합니다.
    """
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            response = await client.get(f"{PDF_BACKEND_URL}/status")
            if response.status_code == 200:
                return response.json() # {"is_processing": bool}
        except Exception as e:
            print(f"Failed to check status: {e}")
            return {"is_processing": False} # 에러 시 처리 중이 아니라고 가정하거나 에러 처리

    # 2. 페이지 생성
    try:
        pdf_filename = file.filename
        page_name = pdf_filename.replace(".pdf", "")
        
        new_page = Page(
            workspace_id=workspace_id,
            user_id=user_id,
            page_name=page_name,
            page_type="doc", # 문서 타입
            is_deleted=False
        )
        db.add(new_page)
        db.commit()
        db.refresh(new_page)
        
        page_id = new_page.id
        logger.info(f"✅ Page created: {page_id} ({page_name})")
        
        # 3. 블록 생성 및 저장
        blocks_data = result.get("blocks", [])
        logger.info(f"🧱 Processing {len(blocks_data)} blocks...")
        created_blocks = []
    
    # 순서 보장을 위해 prev_block_id 체이닝 관리
    prev_block_id = None
    
    import uuid
    
    for item in blocks_data:
        block_id = str(uuid.uuid4())
        
        # BlockNote 타입 매핑
        # processor.py에서 이미 heading, paragraph, bulletListItem 등으로 변환됨
        b_type = item["type"]
        b_props = item.get("props", {})
        
        # 이미지의 경우 url을 props에 설정해야 함
        content = [] # BlockNote content format is usually a list of inline objects
        
        if b_type == "paragraph" or b_type == "heading" or b_type == "bulletListItem":
            # 텍스트가 있을 경우
             if item.get("text"):
                content = [{"type": "text", "text": item["text"], "styles": {}}]
        
        elif b_type == "image":
            # 이미지는 content가 아니라 props.url 사용
             if item.get("image_path"):
                 b_props["url"] = item["image_path"]
                 b_props["name"] = item.get("image_filename", "image.png")
                 # 이미지에 캡션이 있다면 content로 넣을 수도 있음
                 
        elif b_type == "table":
             # 테이블도 이미지로 처리되었으면 image 타입으로 변경하거나
             # processor.py에서 table -> image 처리를 안했다면 여기서 처리
             # (현재 processor.py는 table도 크롭해서 image_path를 줌)
             if item.get("image_path"):
                 b_type = "image" # BlockNote엔 table 블록이 복잡하므로 일단 이미지로
                 b_props["url"] = item["image_path"]
                 b_props["name"] = "table.png"
                 
        # DB 모델 생성
        db_block = ContentBlock(
            id=block_id,
            page_id=page_id,
            type=b_type,
            props=b_props,
            content=content if content else [], # Pass list instead of JSON string
            parent_id=None, # 1단계이므로 일단 루트 레벨
            prev_block_id=prev_block_id,
            next_block_id=None,
            children_ids=[] # Pass list instead of JSON string
        )
        
        db.add(db_block)
        created_blocks.append(db_block)
        
        # 체이닝 업데이트 (이전 블록의 next를 현재로)
        if prev_block_id:
            # 이전 블록을 찾아서 업데이트 (Batch 처리 시엔 로직 다를 수 있음)
            # 여기서는 루프 내에서 바로 처리하기 위해 session flush 활용 가능
            # 하지만 간단히 ID만 기억했다가 나중에 한 번에 하거나...
            # 일단은 DB에 바로 업데이트하지 않고 메모리 객체 연결
            pass 
            
        prev_block_id = block_id
            
    # 전체 저장
    # 연결 리스트(Linked List) 구조를 맞추려면, created_blocks를 순회하며 링크 연결 필요
    for i in range(len(created_blocks)):
        if i > 0:
            created_blocks[i].prev_block_id = created_blocks[i-1].id
        if i < len(created_blocks) - 1:
            created_blocks[i].next_block_id = created_blocks[i+1].id
            
        # 다시 DB에 반영 (Add는 루프에서 했으므로 Commit만)
        db.commit()
        logger.info(f"✅ Saved {len(created_blocks)} blocks to DB.")
        
        return {
            "status": "success",
            "page_id": page_id,
            "block_count": len(created_blocks)
        }
    except Exception as e:
        logger.error(f"❌ Error saving to DB: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save PDF content: {str(e)}")
