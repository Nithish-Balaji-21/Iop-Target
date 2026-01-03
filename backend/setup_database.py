#!/usr/bin/env python
"""
Database setup script - Creates glaucoma_db and tables using SQLAlchemy
Run: python setup_database.py
"""
import os
import sys

# Try to load environment variables (optional)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not installed. Using default values or environment variables.")
    print("   Install with: pip install python-dotenv")

# MySQL connection details from environment or defaults
HOST = os.getenv("DB_HOST", "localhost")
USER = os.getenv("DB_USER", "root")
PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "glaucoma_db")
DB_PORT = int(os.getenv("DB_PORT", "3306"))

def setup_database():
    """Create database and tables using SQLAlchemy"""
    try:
        import pymysql
        from sqlalchemy import create_engine, text
        
        # Step 1: Connect to MySQL (without database) to create database
        print("🔌 Connecting to MySQL...")
        mysql_conn = pymysql.connect(
            host=HOST,
            user=USER,
            password=PASSWORD,
            port=DB_PORT
        )
        cursor = mysql_conn.cursor()
        print("✓ Connected to MySQL")
        
        # Create database if it doesn't exist
        print(f"📁 Creating database '{DB_NAME}'...")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        print(f"✓ Database created/exists")
        
        cursor.close()
        mysql_conn.close()
        
        # Step 2: Use SQLAlchemy to create tables
        print("📊 Creating tables from SQLAlchemy models...")
        from app.database import Base, engine
        from app.models import Patient, IOPMeasurement, TargetPressure, Visit, EMRRecord, GlaucomaRiskData
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✓ Tables created successfully")
        
        # Verify tables
        print("\n📋 Verifying tables...")
        with engine.connect() as conn:
            result = conn.execute(text("SHOW TABLES"))
            tables = [row[0] for row in result]
            
        print(f"\n✅ Database setup complete!")
        print(f"\n📋 Tables in database ({len(tables)}):")
        for table in tables:
            print(f"   - {table}")
        
        return True
        
    except ImportError as e:
        print(f"\n❌ Import Error: {e}")
        print("   Make sure you're running from the backend directory and dependencies are installed:")
        print("   pip install -r requirements.txt")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("GLAUCOMA MONITORING SYSTEM - DATABASE SETUP")
    print("=" * 60)
    print()
    
    success = setup_database()
    
    print()
    if success:
        print("✅ Ready to run: python run.py")
    else:
        print("❌ Setup failed. Check errors above.")
        sys.exit(1)
