from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.workspace.model import WorkSpace, WorkspaceMember
from app.auth.model import User
from app.workspace.service import get_workspaces_by_user, create_workspace
from app.workspace.schema import WorkspaceRequest

import os
# Force local connection
DATABASE_URL = "mysql+pymysql://root:qwer5377~@localhost:3307/stacknote"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

print("\n--- Verifying Workspace Isolation ---")

# 1. Select two users
users = db.query(User).limit(2).all()
if len(users) < 2:
    print("Not enough users to test.")
    exit()

u1 = users[0]
u2 = users[1]
print(f"User A: {u1.email_id} (ID: {u1.id})")
print(f"User B: {u2.email_id} (ID: {u2.id})")

# 2. Check what User B currently sees
ws_b_before = get_workspaces_by_user(db, u2.id)
ids_b_before = [w['id'] for w in ws_b_before]
print(f"User B initially sees workspaces: {ids_b_before}")

# 3. Create NEW Workspace for User A
print("\nCreating 'Isolated Workspace' for User A...")
new_ws = create_workspace(db, WorkspaceRequest(
    user_id=u1.id,
    work_space_name="Isolated Workspace",
    page_type="team"
))
print(f"Created Workspace ID: {new_ws.id}")

# 4. Check if User B sees it
ws_b_after = get_workspaces_by_user(db, u2.id)
ids_b_after = [w['id'] for w in ws_b_after]
print(f"User B now sees workspaces: {ids_b_after}")

# 5. Verification
if str(new_ws.id) in ids_b_after:
    print("\n[FAIL] User B can see the new workspace!")
else:
    print("\n[SUCCESS] User B CANNOT see the new workspace.")

# Cleanup
db.delete(new_ws)
db.commit()
print("\nCleaned up test workspace.")
db.close()
