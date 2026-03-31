from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from shared.database.core.database import get_db
from shared.schemas.block import BlockResponse, BlockSyncRequest
from shared.database.crud import block as block_crud
from app.auth.security import get_current_user
from shared.database.models.user import User

router = APIRouter(
    prefix="/pages/{page_id}/blocks",
    tags=["Block"]
)

@router.get("", response_model=List[BlockResponse])
def read_blocks(
    page_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all blocks for a specific page.
    """
    blocks = block_crud.get_blocks_by_page(db, page_id)
    return blocks

@router.post("", response_model=List[BlockResponse])
def sync_page_blocks(
    page_id: str, 
    request: BlockSyncRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sync (Upsert) a list of blocks for a page.
    This is called by the frontend editor to save changes.
    """
    synced_blocks = block_crud.sync_blocks(db, page_id, request.blocks)
    return synced_blocks
