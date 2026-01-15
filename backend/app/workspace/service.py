# backend/crud/work_space.py

from sqlalchemy.orm import Session

from .model import WorkSpace,Page
from .schema import WorkspaceRequest,PageListCreateRequest
from .constants import DEFAULT_PAGES


def create_workspace(
    db: Session,
    workspace_data: WorkspaceRequest
) -> WorkSpace:
    """
    워크스페이스 생성
    """
    print(f"DEBUG: create_workspace data: {workspace_data}")
    print(f"DEBUG: work_space_name type: {type(workspace_data.work_space_name)}")


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

def create_default_pages(
    db: Session,
    workspace_id: int,
    user_id: int
) -> list[int]:
    """
    워크스페이스 생성 시 기본 페이지 생성
    """
    created_page_ids: list[int] = []

    for page in DEFAULT_PAGES:
        new_page = Page(
            workspace_id=workspace_id,
            user_id=user_id,
            page_name=page["page_name"],
            page_type=page["page_type"],
            is_deleted=False
        )
        db.add(new_page)
        db.flush()  # id 생성
        created_page_ids.append(new_page.id)

    return created_page_ids


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