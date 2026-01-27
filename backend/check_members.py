from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.workspace.model import WorkSpace, WorkspaceMember
from app.auth.model import User
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL - Force local connection for debugging script
# DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3307/stacknote")
# Overwrite for host execution
DATABASE_URL = "mysql+pymysql://root:qwer5377~@localhost:3307/stacknote"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

from app.workspace.service import get_workspace_members

print("\n--- Testing Service Function Output ---")
workspaces = db.query(WorkSpace).all()
for ws in workspaces:
    print(f"\nFetching members for Workspace ID: {ws.id}")
    try:
        members_data = get_workspace_members(db, ws.id)
        print("Result:", members_data)
    except Exception as e:
        print(f"Error: {e}")

db.close()
