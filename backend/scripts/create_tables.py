from sqlalchemy import create_engine
from shared.database.core.database import Base
from shared.database.models.user import User
from shared.database.models.workspace import WorkSpace, Page, VoiceChannel

# Use absolute path in /tmp to avoid permission/path issues
SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/stacknote_test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Tables created.")
