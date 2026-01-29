from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, SQLALCHEMY_DATABASE_URL
from app.auth.service import create_user
from app.auth.schema import UserPostRequest
from app.workspace.model import WorkSpace, Page, VoiceChannel
import uuid

# Setup DB connection (local verification)
SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/stacknote_test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def test_signup_flow():
    email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
    password = "password123"
    
    print(f"--- Starting Signup Test for {email} ---")
    
    try:
        # 1. Create User (triggers workspace creation)
        new_user_req = UserPostRequest(email_id=email, pw=password)
        created_user = create_user(new_user_req, db)
        print(f"✅ User Created: ID={created_user.id}")
        
        # 2. Check Workspace
        workspace = db.query(WorkSpace).filter(WorkSpace.user_id == created_user.id).first()
        if not workspace:
            print("❌ Workspace NOT created!")
            return
        print(f"✅ Workspace Created: ID={workspace.id}, Name={workspace.work_space_name}")
        
        # 3. Check Pages
        pages = db.query(Page).filter(Page.workspace_id == workspace.id).all()
        print(f"ℹ️  Found {len(pages)} Pages")
        for p in pages:
            print(f"   - Page: {p.page_name} (Type: {p.page_type})")
            
        # 4. Check Voice Channels
        channels = db.query(VoiceChannel).filter(VoiceChannel.workspace_id == workspace.id).all()
        print(f"ℹ️  Found {len(channels)} Voice Channels")
        for c in channels:
            print(f"   - Channel: {c.name}")
            
        if len(pages) > 0 and len(channels) > 0:
            print("🎉 SUCCESS: Check complete. Default resources exist.")
        else:
            print("⚠️  FAILURE: Missing resources.")
            
    except Exception as e:
        print(f"❌ Error during test: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_signup_flow()
