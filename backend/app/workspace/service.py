# backend/app/workspace/service.py

from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid

from app.auth.model import User
from .model import WorkSpace, Page, VoiceChannel, WorkspaceMember
from .schema import WorkspaceRequest, BlockCreate, BlockUpdate, PageListCreateRequest, VoiceChannelCreateQuery, WorkspaceInviteRequest
from fastapi import HTTPException
from .constants import DEFAULT_PAGES
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

def get_workspaces_by_user(db: Session, user_id: int):
    """
    유저의 모든 워크스페이스 조회 (페이지 포함)
    """
    workspaces = (
        db.query(WorkSpace)
        .outerjoin(WorkspaceMember, WorkSpace.id == WorkspaceMember.workspace_id)
        .filter(
            (WorkSpace.user_id == user_id) | (WorkspaceMember.user_id == user_id),
            WorkSpace.is_deleted == False
        )
        .distinct()
        .all()
    )
    results = []
    for ws in workspaces:
         # 해당 워크스페이스의 페이지 조회
        pages = db.query(Page).filter(
            Page.workspace_id == ws.id,
            Page.is_deleted == False
        ).all()
        
        # 페이지 분류 (private/team) - 현재 모델엔 구분 컬럼이 없어서 workspace type을 따르거나 별도 로직 필요
        # 임시로 워크스페이스 타입에 따라 전체 페이지를 넣음
        
        ws_data = {
            "id": str(ws.id),
            "name": ws.work_space_name,
            "type": ws.page_type, # private or team
            "privatePages": [],
            "teamPages": [],
            "voiceChannels": [] # Voice channels 구현 시 추가
        }
        
        for p in pages:
            # Determine page type based on p.page_type
            # Default to workspace type if p.page_type is missing (backward compatibility)
            current_type = p.page_type if p.page_type else ws.page_type
            
            # Normalize type string (handle "PRIVATE", "private", "TEAM", "team")
            is_team = current_type in ["TEAM", "team"]
            final_type = "team" if is_team else "private"

            page_data = {
                "id": str(p.id),
                "title": p.page_name,
                "content": "", # 목록 조회시엔 컨텐츠 제외 (가벼운 응답)
                "type": final_type
            }
            
            if final_type == "private":
                ws_data["privatePages"].append(page_data)
            else:
                ws_data["teamPages"].append(page_data)
                
        # Fetch Voice Channels
        voice_channels = db.query(VoiceChannel).filter(
            VoiceChannel.workspace_id == ws.id,
            VoiceChannel.is_deleted == False
        ).all()
        
        ws_data["voiceChannels"] = [
            {
                "id": vc.id,
                "name": vc.name,
                "users": [] # Realtime user status is handled via WebSocket/Redis usually, defaulting to empty
            }
            for vc in voice_channels
        ]

        results.append(ws_data)
        
    return results


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

    return workspace


def create_default_pages(
    db: Session,
    workspace_id: int,
    user_id: int
) -> list[str]:
    """
    워크스페이스 생성 시 기본 페이지 생성
    """
    created_page_ids: list[str] = []

    for page in DEFAULT_PAGES:
        if page["page_type"] == "VOICE":
            # Create Voice Channel
            new_channel = VoiceChannel(
                workspace_id=workspace_id,
                name=page["page_name"],
                is_deleted=False
            )
            db.add(new_channel)
            db.flush()
        else:
            # Create Page
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
    
    db.commit()

    return created_page_ids

# =========================
# Block CRUD & Logic
# =========================
# def get_blocks(db: Session, page_id: str):
#     """
#     페이지 내 모든 블록을 순서대로 조회
#     """
#     return db.query(Block).filter(
#         Block.page_id == page_id,
#         Block.is_deleted == False
#     ).order_by(Block.order.asc()).all()

# def create_block(db: Session, block_data: BlockCreate):
#     """
#     새 블록 생성
#     """
#     new_block_id = str(uuid.uuid4())
#     block = Block(
#         id=new_block_id,
#         page_id=block_data.page_id,
#         workspace_id=block_data.workspace_id,
#         user_id=block_data.user_id,
#         block_type=block_data.block_type,
#         content=block_data.content,
#         order=block_data.order,
#         parent_id=block_data.parent_id
#     )
#     db.add(block)
#     db.commit()
#     db.refresh(block)
#     return block

# def update_block(db: Session, block_id: str, updates: BlockUpdate):
#     """
#     블록 수정
#     """
#     block = db.query(Block).filter(Block.id == block_id).first()
#     if not block:
#         return None
    
#     update_data = updates.dict(exclude_unset=True)
#     for key, value in update_data.items():
#         setattr(block, key, value)
    
#     db.commit()
#     db.refresh(block)
#     return block

# def delete_block(db: Session, block_id: str):
#     """
#     블록 삭제 (Soft Delete)
#     """
#     block = db.query(Block).filter(Block.id == block_id).first()
#     if not block:
#         return None
    
#     block.is_deleted = True
#     db.commit()
#     return block

# def move_block(db: Session, block_id: str, target_order: float):
#     """
#     블록 순서 이동
#     """
#     return update_block(db, block_id, BlockUpdate(order=target_order))

def create_page_list(
    db: Session,
    page_list_data: PageListCreateRequest
) -> list[str]:
    """
    페이지 리스트 생성 (여러 페이지 한번에)
    """

    created_page_ids: list[str] = []

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


    return len(pages)

def create_voice_channel(
    db: Session,
    query: VoiceChannelCreateQuery
) -> VoiceChannel:
    """
    보이스 채널 생성
    """
    channel = VoiceChannel(
        workspace_id=query.work_space_id,
        name=query.channel_name,
        is_deleted=False
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel

def invite_member_to_workspace(
    db: Session,
    workspace_id: int,
    invite_data: WorkspaceInviteRequest,
    requester_id: int
):
    """
    워크스페이스 멤버 초대
    """
    # 1. 워크스페이스 확인
    workspace = db.query(WorkSpace).filter(
        WorkSpace.id == workspace_id,
        WorkSpace.is_deleted == False
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    # 2. 권한 확인 (현재는 소유자만 초대 가능)
    if workspace.user_id != requester_id:
        # TODO: 추후 관리자 권한 확인 로직 추가
        raise HTTPException(status_code=403, detail="Only workspace owner can invite members")
        
    # 3. 워크스페이스 타입 확인 (개인 스페이스는 초대 불가)
    if workspace.page_type == "private":
         raise HTTPException(status_code=400, detail="Cannot invite members to a private workspace")

    # 4. 대상 유저 확인
    target_user = db.query(User).filter(User.email_id == invite_data.email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found with this email")
        
    # 5. 이미 멤버인지 확인
    if target_user.id == workspace.user_id:
        raise HTTPException(status_code=400, detail="User is already the owner")
        
    existing_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace.id,
        WorkspaceMember.user_id == target_user.id
    ).first()
    
    if existing_member:
        raise HTTPException(status_code=409, detail="User is already a member")
        
    # 6. 멤버 추가
    new_member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=target_user.id,
        role="member"
    )
    db.add(new_member)
    db.commit()
    
    return {"status": "success", "message": f"User {target_user.email_id} invited to workspace"}
