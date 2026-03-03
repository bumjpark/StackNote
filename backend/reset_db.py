from shared.database.core.database import engine, Base
from shared.database.models.user import User
from shared.database.models.workspace import WorkSpace, Page, VoiceChannel, WorkspaceMember
from shared.database.models import workspace # Ensure all models are loaded

def reset_db():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Database reset complete.")

if __name__ == "__main__":
    reset_db()
