from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from .model import WorkSpace, Page
from . import service
from .schema import (
    WorkspaceRequest,
    WorkspaceResponse,
    WorkspaceUserResponse,
    PageListCreateRequest,
    PageListCreateResponse,
    PageListUserResponse
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
    # 1️⃣ 워크스페이스 생성
    workspace = service.create_workspace(
        db=db,
        workspace_data=request
    )

    # 2️⃣ 기본 페이지 자동 생성
    service.create_default_pages(
        db=db,
        workspace_id=workspace.id,
        user_id=request.user_id
    )

    return WorkspaceResponse(
        status="success",
        user=WorkspaceUserResponse(
            work_space_id=workspace.id,
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
    )


# =========================
# 페이지 리스트 생성
# =========================
@router.post("/page_list", response_model=PageListCreateResponse)
def create_page_list(
    request: PageListCreateRequest,
    db: Session = Depends(get_db)
):
    created_page_ids = []
    
    # 요청받은 페이지 이름 리스트를 순회하며 각각 Page 생성
    for page_name in request.page_list:
        page = Page(
            workspace_id=request.work_space_id,
            user_id=request.user_id,
            page_name=page_name,
            page_type=request.page_type,
            is_deleted=False
        )
        db.add(page)
        db.flush() # ID 발급을 위해 flush
        db.refresh(page)
        created_page_ids.append(page.id)

    db.commit()

    return PageListCreateResponse(
        status="success",
        user=PageListUserResponse(
            work_space_id=request.work_space_id,
            page_list_id=created_page_ids
        )
    )


@router.delete("/page_list/{page_id}", response_model=PageListCreateResponse)
def delete_page_exact(
    page_id: int,
    db: Session = Depends(get_db)
):
    page = db.query(Page).filter(
        Page.id == page_id,
        Page.is_deleted == False
    ).first()

    if not page:
        raise HTTPException(
            status_code=404,
            detail="Page not found"
        )

    page.is_deleted = True
    db.commit()

    return PageListCreateResponse(
        status="success",
    )
