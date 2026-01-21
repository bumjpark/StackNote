from pydantic import BaseModel, Field
from typing import Optional, Any, List

# Workspace Schemas
class WorkspaceRequest(BaseModel):
    user_id: int
    work_space_name: str
    page_type: str

class WorkspaceUserResponse(BaseModel):
    work_space_id: int
    work_space_name: str

class WorkspaceResponse(BaseModel):
    user: Optional[WorkspaceUserResponse] = None
    
class WorkspaceInviteRequest(BaseModel):
    email: str
    inviter_id: int

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

class WorkspaceUpdate(BaseModel):
    work_space_name: str

class PageUpdate(BaseModel):
    page_name: Optional[str] = None
    icon: Optional[str] = None

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


class PageListCreateRequest(BaseModel):
    user_id: int
    work_space_id: int
    page_type: str
    page_list: list[str]

class PageListUserResponse(BaseModel):
    work_space_id: int
    page_list_id: list[str]

class PageListCreateResponse(BaseModel):
    status: str
    user: Optional[PageListUserResponse] = None

class VoiceChannelCreateQuery(BaseModel):
    user_id: int
    work_space_id: int
    channel_name: str

class VoiceChannelCreateResponse(BaseModel):
    status: str
    channel_id: str
    channel_name: str
