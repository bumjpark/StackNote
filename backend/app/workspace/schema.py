from pydantic import BaseModel, Field
from typing import Optional, Any, List

# Workspace Schemas
class WorkspaceRequest(BaseModel):
    user_id: int
    work_space_name: str
    page_type: str

class WorkspaceUserResponse(BaseModel):
    id: int
    work_space_name: str

class WorkspaceResponse(BaseModel):
    status: str
    user: WorkspaceUserResponse

# Block Schemas
class BlockBase(BaseModel):
    block_type: str
    content: Optional[dict[str, Any]] = None

class BlockCreate(BlockBase):
    page_id: str
    workspace_id: int
    user_id: int
    order: float
    parent_id: Optional[str] = None

class BlockUpdate(BaseModel):
    block_type: Optional[str] = None
    content: Optional[dict[str, Any]] = None
    order: Optional[float] = None
    parent_id: Optional[str] = None

class BlockResponse(BlockBase):
    id: str
    page_id: str
    workspace_id: int
    user_id: int
    order: float
    parent_id: Optional[str] = None
    # children: List['BlockResponse'] = [] # Optional: for recursive loading

    class Config:
        orm_mode = True
