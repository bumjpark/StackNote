# backend/app/workspace/service.py

from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid

from shared.database.models.user import User
from shared.database.models.workspace import WorkSpace, Page, VoiceChannel, WorkspaceMember, PageMember
from shared.schemas.workspace import WorkspaceRequest, PageListCreateRequest, VoiceChannelCreateQuery, WorkspaceInviteRequest, PageInviteRequest
from shared.schemas.block import BlockCreate, BlockUpdate
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
    # 1. Owned workspaces
    owned_workspaces = db.query(WorkSpace).filter(
        WorkSpace.user_id == user_id,
        WorkSpace.is_deleted == False
    ).all()

    # 2. Member workspaces (accepted only)
    member_records = db.query(WorkspaceMember).filter(
        WorkspaceMember.user_id == user_id,
        WorkspaceMember.status == 'accepted'
    ).all()
    
    member_workspaces = []
    if member_records:
        member_workspace_ids = [r.workspace_id for r in member_records]
        member_workspaces = db.query(WorkSpace).filter(
            WorkSpace.id.in_(member_workspace_ids),
            WorkSpace.is_deleted == False
        ).all()

    # 3. Workspaces where user is an accepted PageMember
    # [REMOVED] Logic to include workspaces solely based on page membership.
    # We now strictly follow the rule: Switcher only shows OWNED workspaces.
    # Shared pages must be "mounted" to one of the owned workspaces.
    
    # Combine and distinct by ID
    all_workspaces_list = owned_workspaces # + member_workspaces + page_member_workspaces
    all_workspaces_map = {ws.id: ws for ws in all_workspaces_list}
    workspaces = list(all_workspaces_map.values())
    results = []
    for ws in workspaces:
        # 1. Fetch pages OWNED by user in this workspace
        owned_pages = db.query(Page).filter(
            Page.workspace_id == ws.id,
            Page.user_id == user_id,
            Page.is_deleted == False
        ).all()
        
        # 2. Fetch pages SHARED to this workspace (Mounted)
        # Find PageMember records where target_workspace_id == ws.id AND status == 'accepted'
        mounted_memberships = db.query(PageMember).filter(
            PageMember.target_workspace_id == ws.id,
            PageMember.status == 'accepted'
        ).all()
        
        mounted_page_ids = [pm.page_id for pm in mounted_memberships]
        mounted_pages = []
        if mounted_page_ids:
            mounted_pages = db.query(Page).filter(
                Page.id.in_(mounted_page_ids),
                Page.is_deleted == False
            ).all()
            
        all_pages = owned_pages + mounted_pages
        # Remove duplicates if any (though logic shouldn't allow overlap easily)
        unique_pages = {p.id: p for p in all_pages}.values()

        is_ws_owner = (ws.user_id == user_id)
        
        ws_data = {
            "id": str(ws.id),
            "name": ws.work_space_name,
            "privatePages": [],
            "teamPages": [],
            "voiceChannels": []
        }
        
        for p in unique_pages:
            current_type = p.page_type if p.page_type else "private"
            is_team = current_type in ["TEAM", "team"]
            final_type = "team" if is_team else "private"
            
            page_data = {
                "id": str(p.id),
                "title": p.page_name,
                "icon": p.icon,
                "content": "",
                "type": final_type,
                "is_owner": (p.user_id == user_id) # Flag to identify ownership
            }
            
            if final_type == "private":
                ws_data["privatePages"].append(page_data)
            else:
                ws_data["teamPages"].append(page_data)
                
        # Voice Channels (Simple fetch for now, can be refined to page-based)
        voice_channels = db.query(VoiceChannel).filter(
            VoiceChannel.workspace_id == ws.id,
            VoiceChannel.is_deleted == False
        ).all()
        
        ws_data["voiceChannels"] = [
            {
                "id": vc.id,
                "name": vc.name,
                "page_id": vc.page_id,
                "users": []
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
    workspace = db.query(WorkSpace).filter(WorkSpace.id == workspace_id).first()
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
            
            # [NEW] Add creator as the first member of the page
            owner_member = PageMember(
                page_id=new_page.id,
                user_id=user_id,
                role="owner",
                status="accepted"
            )
            db.add(owner_member)
            
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
        
        # [NEW] Add creator as the first member of the page
        owner_member = PageMember(
            page_id=page.id,
            user_id=page_list_data.user_id,
            role="owner",
            status="accepted"
        )
        db.add(owner_member)
        
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
    보이스 채널 생성 (권한 확인 포함)
    """
    # 1. 워크스페이스 확인
    workspace = db.query(WorkSpace).filter(
        WorkSpace.id == query.work_space_id,
        WorkSpace.is_deleted == False
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # 2. 권한 확인 (소유자이거나 승인된 멤버여야 함)
    is_owner = workspace.user_id == query.user_id
    is_member = False
    
    if not is_owner:
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == query.user_id,
            WorkspaceMember.status == "accepted"
        ).first()
        if membership:
            is_member = True
            
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to create voice channels in this workspace")

    # If page_id is provided, verify it belongs to workspace
    if query.page_id:
        page = db.query(Page).filter(Page.id == query.page_id, Page.workspace_id == query.work_space_id).first()
        if not page:
            raise HTTPException(status_code=404, detail="Page not found in this workspace")

    channel = VoiceChannel(
        workspace_id=query.work_space_id,
        page_id=query.page_id,
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
        
    # 3. 워크스페이스 타입 확인 (개인 스페이스는 초대 불가) - Removed as every workspace has both private and team spaces
    # if workspace.page_type == "private":
    #      raise HTTPException(status_code=400, detail="Cannot invite members to a private workspace")

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
        role="member",
        status="pending"
    )
    db.add(new_member)
    db.commit()
    
    return {"status": "success", "message": f"User {target_user.email_id} invited to workspace"}

def get_user_invitations(db: Session, user_id: int):
    """
    대기 중인 초대 목록 조회
    """
    # 사용자가 'pending' 상태로 멤버에 포함된 워크스페이스 찾기
    pending_memberships = db.query(WorkspaceMember).filter(
        WorkspaceMember.user_id == user_id,
        WorkspaceMember.status == "pending"
    ).all()
    
    results = []
    for pm in pending_memberships:
        workspace = db.query(WorkSpace).filter(WorkSpace.id == pm.workspace_id).first()
        if workspace:
            results.append({
                "workspace_id": workspace.id,
                "workspace_name": workspace.work_space_name,
                "inviter_id": workspace.user_id, # Assuming owner invited for now
                "invited_at": pm.joined_at
            })

    # [NEW] Page Invitations
    pending_page_memberships = db.query(PageMember).filter(
        PageMember.user_id == user_id,
        PageMember.status == "pending"
    ).all()
    
    for ppm in pending_page_memberships:
        page = db.query(Page).filter(Page.id == ppm.page_id).first()
        if page:
            results.append({
                "id": page.id, # String ID for pages
                "name": page.page_name,
                "type": "page",
                "workspace_id": page.workspace_id,
                "invited_at": ppm.joined_at
            })
    return results

def respond_page_invitation(db: Session, page_id: str, user_id: int, response: str, target_workspace_id: int = None):
    """
    페이지 초대 응답 (수락/거절)
    """
    member_record = db.query(PageMember).filter(
        PageMember.page_id == page_id,
        PageMember.user_id == user_id,
        PageMember.status == "pending"
    ).first()
    
    if not member_record:
        raise HTTPException(status_code=404, detail="No pending page invitation found")
        
    if response == "accepted":
        member_record.status = "accepted"
        if target_workspace_id:
            member_record.target_workspace_id = target_workspace_id
        db.commit()
        return {"status": "success", "message": "Page invitation accepted"}
    elif response == "declined":
        db.delete(member_record)
        db.commit()
        return {"status": "success", "message": "Page invitation declined"}
    else:
        raise HTTPException(status_code=400, detail="Invalid response")

def respond_invitation(db: Session, workspace_id: int, user_id: int, response: str):
    """
    초대 응답 (수락/거절)
    """
    member_record = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
        WorkspaceMember.status == "pending"
    ).first()
    
    if not member_record:
        raise HTTPException(status_code=404, detail="No pending invitation found")
        
    if response == "accepted":
        member_record.status = "accepted"
        db.commit()
        return {"status": "success", "message": "Invitation accepted"}
    elif response == "declined":
        db.delete(member_record) # 거절 시 기록 삭제 (또는 declined status로 변경)
        db.commit()
        return {"status": "success", "message": "Invitation declined"}
    else:
        raise HTTPException(status_code=400, detail="Invalid response")

def update_workspace(db: Session, workspace_id: int, name: str):
    workspace = db.query(WorkSpace).filter(WorkSpace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    workspace.work_space_name = name
    db.commit()
    db.refresh(workspace)
    return workspace

def update_page(db: Session, page_id: str, updates: dict):
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    for key, value in updates.items():
        if value is not None:
            setattr(page, key, value)
            
    db.commit()
    db.refresh(page)
    return page
    return service.respond_invitation(db, workspace_id, user_id, "declined")

def get_workspace_members(db: Session, workspace_id: int):
    """
    워크스페이스의 멤버 목록 조회 (Accepted status only)
    """
    # 1. Fetch relations
    members = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.status == 'accepted'
    ).all()
    
    # 2. Add owner? (Owner might not be in WorkspaceMember table depending on logic, 
    # but usually owner is implicitly a member. Let's check WorkSpace owner first.)
    workspace = db.query(WorkSpace).filter(WorkSpace.id == workspace_id).first()
    if not workspace:
        return []

    result = []
    
    # Add Owner
    owner = db.query(User).filter(User.id == workspace.user_id).first()
    if owner:
         result.append({
            "id": owner.id,
            "email": owner.email_id,
            "name": owner.email_id.split('@')[0], # Fallback name
            "role": "owner"
        })

    # Add Members
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user and user.id != workspace.user_id: # Avoid duplicate if owner is in member table
             result.append({
                "id": user.id,
                "email": user.email_id,
                "name": user.email_id.split('@')[0],
                "role": m.role
            })
            
    return result


def invite_member_to_page(
    db: Session,
    page_id: str,
    invite_data: PageInviteRequest,
    requester_id: int
):
    """
    페이지에 멤버 초대
    """
    page = db.query(Page).filter(Page.id == page_id, Page.is_deleted == False).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
        
    # 권한: 페이지 생성자(Owner) 또는 워크스페이스 소유자?
    # 일단 Page.user_id == requester_id 체크
    # 워크스페이스 소유자도 가능하게 하려면 WS 조회 필요.
    if page.user_id != requester_id:
        workspace = db.query(WorkSpace).filter(WorkSpace.id == page.workspace_id).first()
        if not workspace or workspace.user_id != requester_id:
             raise HTTPException(status_code=403, detail="Not authorized to invite to this page")

    target_user = db.query(User).filter(User.email_id == invite_data.email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.id == page.user_id:
        raise HTTPException(status_code=400, detail="User is the page owner")
        
    existing = db.query(PageMember).filter(PageMember.page_id == page_id, PageMember.user_id == target_user.id).first()
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=409, detail="User is already a member")
        elif existing.status == "pending":
            return {"status": "success", "message": "Already invited (pending)"}
    
    new_member = PageMember(
        page_id=page_id, 
        user_id=target_user.id, 
        role="member", 
        status="pending" # [NEW] Requires acceptance
    )
    db.add(new_member)
    db.commit()
    
    return {"status": "success", "message": f"Invitation sent to {target_user.email_id}"}

def get_page_members(db: Session, page_id: str):
    members = db.query(PageMember).filter(
        PageMember.page_id == page_id,
        PageMember.status == "accepted"
    ).all()
    
    result = []
    
    # Page Owner
    page = db.query(Page).filter(Page.id == page_id).first()
    if page:
        owner = db.query(User).filter(User.id == page.user_id).first()
        if owner:
            result.append({
                "id": owner.id,
                "email": owner.email_id,
                "name": owner.email_id.split('@')[0],
                "role": "owner"
            })
            
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user and user.id != page.user_id:
            result.append({
                "id": user.id,
                "email": user.email_id,
                "name": user.email_id.split('@')[0],
                "role": m.role
            })
            
    return result
