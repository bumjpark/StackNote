from shared.database.core.database import engine, Base

def reset_db():
    print("Dropping all tables...")
    try:
        Base.metadata.drop_all(bind=engine)
        print("Tables dropped.")
        print("Creating all tables...")
        Base.metadata.create_all(bind=engine)
        print("Database reset complete.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_db()
