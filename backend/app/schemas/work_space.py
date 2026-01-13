from pydantic import BaseModel


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
