from sqlalchemy.orm import Session
from typing import List
from app.models import ContentBlock as Block
from app.schemas.block import BlockCreate, BlockUpdate

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
    Simple strategy: 
    1. Upsert (Update if exists, Create if not)
    2. (Optional refinement) Mark missing blocks as deleted if needed
       For now, we just upsert to ensure everything sent is saved.
    """
    results = []
    
    for block_data in blocks:
        existing_block = db.query(Block).filter(Block.id == block_data.id).first()
        
        if existing_block:
            # Update
            existing_block.type = block_data.type
            existing_block.props = block_data.props
            existing_block.content = block_data.content
            existing_block.children_ids = block_data.children_ids
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
                prev_block_id=block_data.prev_block_id,
                next_block_id=block_data.next_block_id
            )
            db.add(new_block)
            results.append(new_block)
            
    db.commit()
    return results
