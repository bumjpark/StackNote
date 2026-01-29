from shared.database.core.database import engine, Base
# Import all models to ensure they are registered with Base.metadata
from shared.database.models.user import User
from shared.database.models.workspace import (
    WorkSpace, WorkspaceMember, PageMember, Page, 
    VoiceChannel, Report, Chatroom, ChatroomUsers, 
    Message, ContentBlock, VoiceChat
)

import time
from sqlalchemy.exc import OperationalError

def reset_db():
    max_retries = 30
    retry_delay = 2
    retries = 0
    
    while retries < max_retries:
        try:
            print(f"Attempting to connect to DB (Attempt {retries + 1}/{max_retries})...")
            print("Dropping all tables...")
            Base.metadata.drop_all(bind=engine)
            print("Creating all tables...")
            Base.metadata.create_all(bind=engine)
            print("Database reset complete.")
            return
        except OperationalError as e:
            retries += 1
            print(f"Database not ready yet. Error: {e}")
            time.sleep(retry_delay)
        except Exception as e:
            print(f"Unexpected error: {e}")
            time.sleep(retry_delay)
            retries += 1
            
    print("Could not connect to database after maximum retries.")

if __name__ == "__main__":
    reset_db()
