from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from typing import List, Optional
from sqlalchemy.orm import Session

from shared.database.core.database import get_db
from shared.database.models.workspace import WorkSpace, Page
from . import service
from shared.schemas.workspace import (
    WorkspaceRequest,
    WorkspaceResponse,
    WorkspaceUserResponse,
    PageListCreateRequest,
    PageListCreateResponse,
    PageListUserResponse,
    VoiceChannelCreateQuery,
    VoiceChannelCreateResponse,
    WorkspaceInviteRequest,
    WorkspaceUpdate,
    PageUpdate,
    WorkspaceMemberResponse
)
from shared.schemas.block import BlockCreate, BlockUpdate, BlockResponse
from . import pdf_service # [NEW]

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

@router.post("/pages/upload-pdf")
async def upload_pdf_and_create_page(
    workspace_id: int = Body(...),
    user_id: int = Body(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    PDF 파일을 업로드하고 분석하여 새로운 페이지를 생성합니다.
    (PDF Backend로 분석 위임 -> 결과 받아 DB 저장)
    """
    return await pdf_service.process_pdf_upload(db, workspace_id, user_id, file)


@router.get("/user/{user_id}")
def get_user_workspaces(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    유저의 모든 워크스페이스와 페이지 목록 조회
    """
    return service.get_workspaces_by_user(db, user_id)


# =========================
# 워크스페이스 삭제 (소프트 삭제)
# =========================
@router.delete("/{workspace_id}", response_model=WorkspaceResponse)
def delete_workspace(
    workspace_id: int,
    db: Session = Depends(get_db)
):
    workspace = service.delete_workspace(db, workspace_id)
    if not workspace:
        raise HTTPException(
            status_code=404,
            detail="Workspace not found"
        )

    return WorkspaceResponse(
        status="success",
        user=None
    )

# =========================
# Block API
# =========================
# @router.get("/pages/{page_id}/blocks", response_model=List[BlockResponse])
# def get_page_blocks(page_id: str, db: Session = Depends(get_db)):
#     """페이지의 모든 블록 조회"""
#     return service.get_blocks(db, page_id)

# @router.post("/pages/blocks", response_model=BlockResponse)
# def create_block(block: BlockCreate, db: Session = Depends(get_db)):
#     """블록 생성"""
#     return service.create_block(db, block)

# @router.patch("/blocks/{block_id}", response_model=BlockResponse)
# def update_block(block_id: str, updates: BlockUpdate, db: Session = Depends(get_db)):
#     """블록 수정 (내용 or 순서)"""
#     updated_block = service.update_block(db, block_id, updates)
#     if not updated_block:
#         raise HTTPException(status_code=404, detail="Block not found")
#     return updated_block

# @router.delete("/blocks/{block_id}")
# def delete_block(block_id: str, db: Session = Depends(get_db)):
#     """블록 삭제"""
#     deleted_block = service.delete_block(db, block_id)
#     if not deleted_block:
#         raise HTTPException(status_code=404, detail="Block not found")
#     return {"status": "success", "message": "Block deleted"}

# @router.put("/blocks/{block_id}/move")
# def move_block(block_id: str, target_order: float = Body(..., embed=True), db: Session = Depends(get_db)):
#     """블록 순서 이동"""
#     moved_block = service.move_block(db, block_id, target_order)
#     if not moved_block:
#         raise HTTPException(status_code=404, detail="Block not found")
#     return {"status": "success", "order": moved_block.order}

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
    page_id: str,
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

@router.post("/voice_channel", response_model=VoiceChannelCreateResponse)
def create_voice_channel(
    query: VoiceChannelCreateQuery,
    db: Session = Depends(get_db)
):
    channel = service.create_voice_channel(db, query)
    return VoiceChannelCreateResponse(
        status="success",
        channel_id=channel.id,
        channel_name=channel.name
    )

@router.post("/{workspace_id}/members", tags=["Workspace"])
def invite_member(
    workspace_id: int,
    request: WorkspaceInviteRequest,
    db: Session = Depends(get_db)
):
    """
    워크스페이스에 멤버 초대 (현재는 소유자만 가능)
    """
    return service.invite_member_to_workspace(db, workspace_id, request, request.inviter_id)

@router.get("/{workspace_id}/members", response_model=List[WorkspaceMemberResponse])
def get_members(
    workspace_id: int,
    db: Session = Depends(get_db)
):
    """
    워크스페이스 멤버 조회
    """
    return service.get_workspace_members(db, workspace_id)

@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace_name(
    workspace_id: int,
    updates: WorkspaceUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """
    워크스페이스 이름 수정
    """
    ws = service.update_workspace(db, workspace_id, updates.work_space_name)
    return WorkspaceResponse(
        status="success",
        user=WorkspaceUserResponse(
            work_space_id=ws.id,
            work_space_name=ws.work_space_name
        )
    )

@router.patch("/pages/{page_id}")
def update_page_details(
    page_id: str,
    updates: PageUpdate,
    db: Session = Depends(get_db)
):
    """
    페이지 정보 수정 (이름, 아이콘)
    """
    return service.update_page(db, page_id, updates.dict(exclude_unset=True))

@router.get("/user/{user_id}/invitations", tags=["Workspace Invitation"])
def get_invitations(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    유저가 받은 대기 중인 초대 목록 조회
    """
    return service.get_user_invitations(db, user_id)

@router.post("/invitations/{workspace_id}/accept", tags=["Workspace Invitation"])
def accept_invitation(
    workspace_id: int,
    user_id: int = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    초대 수락
    """
    return service.respond_invitation(db, workspace_id, user_id, "accepted")

@router.post("/invitations/{workspace_id}/decline", tags=["Workspace Invitation"])
def decline_invitation(
    workspace_id: int,
    user_id: int = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    초대 거절
    """
    return service.respond_invitation(db, workspace_id, user_id, "declined")
