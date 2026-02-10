from shared.database.core.database import SessionLocal
from shared.database.core.database import SessionLocal
from shared.database.models.workspace import Page
from shared.database.models.user import User # Load User model specifically

db = SessionLocal()
try:
    pages = db.query(Page).all()
    print(f"{'ID':<40} {'Name':<20} {'Parent ID':<40}")
    print("-" * 100)
    for p in pages:
        print(f"{str(p.id):<40} {p.page_name:<20} {str(p.parent_page_id) if p.parent_page_id else 'None':<40}")
finally:
    db.close()
