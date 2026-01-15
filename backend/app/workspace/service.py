# backend/app/workspace/service.py

from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid

from .model import WorkSpace, Block
from .schema import WorkspaceRequest, BlockCreate, BlockUpdate

# =========================
# WorkSpace CRUD
# =========================
def create_workspace(
    db: Session,
    workspace_data: WorkspaceRequest
) -> WorkSpace:
    """
    워크스페이스 생성
    """
    workspace = WorkSpace(
        user_id=workspace_data.user_id,
        page_type=workspace_data.page_type,
        work_space_name=workspace_data.work_space_name,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace


def delete_workspace(
    db: Session,
    workspace_id: int
) -> WorkSpace | None:
    """
    워크스페이스 삭제 (soft delete)
    """
    workspace = (
        db.query(WorkSpace)
        .filter(
            WorkSpace.id == workspace_id,
            WorkSpace.is_deleted == False
        )
        .first()
    )
    if not workspace:
        return None

    workspace.is_deleted = True
    db.commit()
    db.refresh(workspace)
    return workspace

# =========================
# Block CRUD & Logic
# =========================
def get_blocks(db: Session, page_id: str):
    """
    페이지 내 모든 블록을 순서대로 조회
    """
    return db.query(Block).filter(
        Block.page_id == page_id,
        Block.is_deleted == False
    ).order_by(Block.order.asc()).all()

def create_block(db: Session, block_data: BlockCreate):
    """
    새 블록 생성
    """
    new_block_id = str(uuid.uuid4())
    block = Block(
        id=new_block_id,
        page_id=block_data.page_id,
        workspace_id=block_data.workspace_id,
        user_id=block_data.user_id,
        block_type=block_data.block_type,
        content=block_data.content,
        order=block_data.order,
        parent_id=block_data.parent_id
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block

def update_block(db: Session, block_id: str, updates: BlockUpdate):
    """
    블록 수정
    """
    block = db.query(Block).filter(Block.id == block_id).first()
    if not block:
        return None
    
    update_data = updates.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(block, key, value)
    
    db.commit()
    db.refresh(block)
    return block

def delete_block(db: Session, block_id: str):
    """
    블록 삭제 (Soft Delete)
    """
    block = db.query(Block).filter(Block.id == block_id).first()
    if not block:
        return None
    
    block.is_deleted = True
    db.commit()
    return block

def move_block(db: Session, block_id: str, target_order: float):
    """
    블록 순서 이동
    """
    return update_block(db, block_id, BlockUpdate(order=target_order))