import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Database
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "glaucoma_db")
    DB_PORT = os.getenv("DB_PORT", "3306")
    
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    # API
    API_PORT = int(os.getenv("API_PORT", "8000"))
    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    DEBUG = os.getenv("DEBUG", "True") == "True"
    
    # CORS
    ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:3000", "*"]

settings = Settings()
