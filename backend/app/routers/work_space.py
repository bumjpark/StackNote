from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import WorkSpace
from app.schemas.work_space import (
    WorkspaceRequest,
    WorkspaceResponse,
    WorkspaceUserResponse
)

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
    workspace = WorkSpace(
        user_id=request.user_id,
        page_type=request.page_type,
        work_space_name=request.work_space_name,
        is_deleted=False
    )

    db.add(workspace)
    db.commit()
    db.refresh(workspace)

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
    workspace = db.query(WorkSpace).filter(
        WorkSpace.id == workspace_id,
        WorkSpace.is_deleted == False
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=404,
            detail="Workspace not found"
        )

    workspace.is_deleted = True
    db.commit()

    return WorkspaceResponse(
        status="success",
        user=None
    )