from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime

class BlockBase(BaseModel):
    id: str
    type: str = "paragraph"
    props: Optional[Dict[str, Any]] = {}
    content: Optional[List[Dict[str, Any]]] = []
    children_ids: Optional[List[str]] = []
    parent_id: Optional[str] = None
    prev_block_id: Optional[str] = None
    next_block_id: Optional[str] = None

class BlockCreate(BlockBase):
    pass

class BlockUpdate(BaseModel):
    type: Optional[str] = None
    props: Optional[Dict[str, Any]] = None
    content: Optional[List[Dict[str, Any]]] = None
    children_ids: Optional[List[str]] = None
    prev_block_id: Optional[str] = None
    next_block_id: Optional[str] = None

class BlockResponse(BlockBase):
    page_id: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool

    class Config:
        from_attributes = True

# Used for bulk updates (syncing entire page or partial blocks)
class BlockSyncRequest(BaseModel):
    blocks: List[BlockCreate]
