# backend/app/workspace/service.py

from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid

from .model import WorkSpace, Block, Page
from .schema import WorkspaceRequest, BlockCreate, BlockUpdate, PageListCreateRequest
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

    return update_block(db, block_id, BlockUpdate(order=target_order))

    # return workspace
def create_page_list(
    db: Session,
    page_list_data: PageListCreateRequest
) -> list[int]:
    """
    페이지 리스트 생성 (여러 페이지 한번에)
    """

    created_page_ids: list[int] = []

    for page_name in page_list_data.page_list:
        page = Page(
            workspace_id=page_list_data.work_space_id,
            user_id=page_list_data.user_id,
            page_name=page_name,
            is_deleted=False
        )
        db.add(page)
        db.flush()  # id 생성
        created_page_ids.append(page.id)

    db.commit()

    return created_page_ids

def delete_page_list(
    db: Session,
    *,
    workspace_id: int
) -> int:
    """
    페이지 리스트 삭제 (워크스페이스 기준 soft delete)

    return: 삭제된 페이지 개수
    """

    pages = (
        db.query(Page)
        .filter(
            Page.workspace_id == workspace_id,
            Page.is_deleted == False
        )
        .all()
    )

    if not pages:
        return 0

    for page in pages:
        page.is_deleted = True

    db.commit()

    return len(pages)
>>>>>>> origin/dev
