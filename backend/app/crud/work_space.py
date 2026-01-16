# backend/crud/work_space.py

from sqlalchemy.orm import Session

from app.workspace.model import WorkSpace
from app.schemas.work_space import work_space_request


def create_workspace(
    db: Session,
    workspace_data: work_space_request
) -> WorkSpace:
    """
    워크스페이스 생성
    """

    workspace = WorkSpace(
        user_id=workspace_data.user_id,
        page_type=workspace_data.page_type,
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