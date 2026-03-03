from sqlalchemy.orm import Session
from typing import List
from shared.database.models.workspace import ContentBlock as Block
from shared.schemas.block import BlockCreate, BlockUpdate

def get_blocks_by_page(db: Session, page_id: str):
    return db.query(Block).filter(
        Block.page_id == page_id,
        Block.is_deleted == False
    ).all()

def create_block(db: Session, block: BlockCreate, page_id: str):
    db_block = Block(
        id=block.id,
        page_id=page_id,
        type=block.type,
        props=block.props,
        content=block.content,
        children_ids=block.children_ids,
        parent_id=block.parent_id,
        prev_block_id=block.prev_block_id,
        next_block_id=block.next_block_id
    )
    db.add(db_block)
    db.commit()
    db.refresh(db_block)
    return db_block

def sync_blocks(db: Session, page_id: str, blocks: List[BlockCreate]):
    """
    Syncs the list of blocks from the frontend to the backend.
    Strategy:
    1. Identify blocks currently in DB for this page.
    2. Identify blocks in the incoming request.
    3. Mark blocks present in DB but MISSING in request as 'is_deleted=True'.
    4. Upsert (Update/Create) incoming blocks.
    """
    # 1. Get existing active blocks for this page
    # (잠재적 최적화: 여기서 한 번에 로드해서 메모리에서 비교할 수도 있음)
    db_existing_ids = {
        b.id for b in db.query(Block.id).filter(
            Block.page_id == page_id,
            Block.is_deleted == False
        ).all()
    }
    
    # 2. Get incoming IDs
    incoming_ids = {b.id for b in blocks}
    
    # 3. Find IDs to delete (Simple set difference)
    ids_to_delete = db_existing_ids - incoming_ids
    
    if ids_to_delete:
        db.query(Block).filter(Block.id.in_(ids_to_delete)).update(
            {Block.is_deleted: True},
            synchronize_session=False
        )
    
    # 4. Upsert Loop
    results = []
    for block_data in blocks:
        existing_block = db.query(Block).filter(Block.id == block_data.id).first()
        
        if existing_block:
            # Update
            existing_block.type = block_data.type
            existing_block.props = block_data.props
            existing_block.content = block_data.content
            existing_block.children_ids = block_data.children_ids
            existing_block.parent_id = block_data.parent_id
            existing_block.prev_block_id = block_data.prev_block_id
            existing_block.next_block_id = block_data.next_block_id
            existing_block.is_deleted = False # Restore if it was deleted
            results.append(existing_block)
        else:
            # Create
            new_block = Block(
                id=block_data.id,
                page_id=page_id,
                type=block_data.type,
                props=block_data.props,
                content=block_data.content,
                children_ids=block_data.children_ids,
                parent_id=block_data.parent_id,
                prev_block_id=block_data.prev_block_id,
                next_block_id=block_data.next_block_id
            )
            db.add(new_block)
            results.append(new_block)
            
    db.commit()
    return results
