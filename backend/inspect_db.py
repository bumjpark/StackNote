from app.core.database import SessionLocal
from app.workspace.model import WorkSpace, Page

db = SessionLocal()
try:
    workspaces = db.query(WorkSpace).all()
    for ws in workspaces:
        print(f"Workspace: {ws.id}, Name: {ws.work_space_name}, Type: {ws.page_type}")
        team_pages = db.query(Page).filter(Page.workspace_id == ws.id, Page.page_type == 'team').count()
        print(f"  - Team Pages count: {team_pages}")
finally:
    db.close()
