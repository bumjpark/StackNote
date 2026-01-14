from pydantic import BaseModel
from typing import Optional


class WorkspaceRequest(BaseModel):
    user_id: int
    work_space_name: str
    page_type: str

class WorkspaceUserResponse(BaseModel):
    work_space_id: int
    work_space_name: str

class WorkspaceResponse(BaseModel):
    status: str
    user: Optional[WorkspaceUserResponse] = None


class PageListCreateRequest(BaseModel):
    user_id: int
    work_space_id: int
    page_type: str
    page_list: list[str]

class PageListUserResponse(BaseModel):
    work_space_id: int
    page_list_id: list[int]

class PageListCreateResponse(BaseModel):
    status: str
    user: Optional[PageListUserResponse] = None