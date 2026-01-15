from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from .model import WorkSpace
from .schema import (
    WorkspaceRequest,
    WorkspaceResponse,
    WorkspaceUserResponse,
    BlockCreate,
    BlockUpdate,
    BlockResponse
)
from . import service

router = APIRouter(
    prefix="/workspace",
    tags=["Workspace"]
)


# =========================
# 워크스페이스 생성
# =========================
@router.post("", response_model=WorkspaceResponse)
def create_workspace(
    request: WorkspaceRequest,
    db: Session = Depends(get_db)
):
    workspace = service.create_workspace(db, request)
    return WorkspaceResponse(
        status="success",
        user=WorkspaceUserResponse(
            id=workspace.id,
            work_space_name=workspace.work_space_name
        )
    )


# =========================
# 워크스페이스 삭제 (소프트 삭제)
# =========================
@router.delete("/{workspace_id}", response_model=WorkspaceResponse)
def delete_workspace(
    workspace_id: int,
    db: Session = Depends(get_db)
):
    workspace = service.delete_workspace(db, workspace_id)
    if not workspace:
        raise HTTPException(
            status_code=404,
            detail="Workspace not found"
        )

    return WorkspaceResponse(
        status="success",
        user=None
    )

# =========================
# Block API
# =========================
@router.get("/pages/{page_id}/blocks", response_model=List[BlockResponse])
def get_page_blocks(page_id: str, db: Session = Depends(get_db)):
    """페이지의 모든 블록 조회"""
    return service.get_blocks(db, page_id)

@router.post("/pages/blocks", response_model=BlockResponse)
def create_block(block: BlockCreate, db: Session = Depends(get_db)):
    """블록 생성"""
    return service.create_block(db, block)

@router.patch("/blocks/{block_id}", response_model=BlockResponse)
def update_block(block_id: str, updates: BlockUpdate, db: Session = Depends(get_db)):
    """블록 수정 (내용 or 순서)"""
    updated_block = service.update_block(db, block_id, updates)
    if not updated_block:
        raise HTTPException(status_code=404, detail="Block not found")
    return updated_block

@router.delete("/blocks/{block_id}")
def delete_block(block_id: str, db: Session = Depends(get_db)):
    """블록 삭제"""
    deleted_block = service.delete_block(db, block_id)
    if not deleted_block:
        raise HTTPException(status_code=404, detail="Block not found")
    return {"status": "success", "message": "Block deleted"}

@router.put("/blocks/{block_id}/move")
def move_block(block_id: str, target_order: float = Body(..., embed=True), db: Session = Depends(get_db)):
    """블록 순서 이동"""
    moved_block = service.move_block(db, block_id, target_order)
    if not moved_block:
        raise HTTPException(status_code=404, detail="Block not found")
    return {"status": "success", "order": moved_block.order}