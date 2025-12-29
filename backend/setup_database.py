#!/usr/bin/env python
"""
Database setup script - Creates glaucoma_db and tables
Run: python setup_database.py
"""
import pymysql
import sys

# MySQL connection details
HOST = "localhost"
USER = "root"
PASSWORD = "Nithish@21"
DB_NAME = "glaucoma_db"

def setup_database():
    """Create database and tables"""
    try:
        # Connect without database first
        print("🔌 Connecting to MySQL...")
        conn = pymysql.connect(
            host=HOST,
            user=USER,
            password=PASSWORD,
            port=3306
        )
        cursor = conn.cursor()
        print("✓ Connected to MySQL")
        
        # Create database
        print(f"📁 Creating database '{DB_NAME}'...")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        print(f"✓ Database created/exists")
        
        # Use database
        cursor.execute(f"USE {DB_NAME}")
        print(f"✓ Using database '{DB_NAME}'")
        
        # Read and execute schema file
        print("📊 Creating tables from schema...")
        with open('database_schema.sql', 'r') as f:
            schema = f.read()
            
        # Split by ';' and execute statements
        statements = [s.strip() for s in schema.split(';') if s.strip()]
        
        # Skip comments and empty lines
        statements = [
            s for s in statements 
            if not s.startswith('--') and s.strip()
        ]
        
        # Execute first few statements (database creation, table creation)
        executed = 0
        for i, statement in enumerate(statements):
            if statement.startswith('USE') or statement.startswith('CREATE'):
                try:
                    cursor.execute(statement)
                    executed += 1
                    print(f"  ✓ Executed statement {i+1}")
                except Exception as e:
                    if 'already exists' in str(e).lower():
                        print(f"  ℹ️  Table already exists (skipping)")
                    else:
                        print(f"  ⚠️  {e}")
        
        conn.commit()
        print(f"\n✅ Database setup complete! ({executed} statements executed)")
        
        # Verify
        cursor.execute("SHOW TABLES;")
        tables = cursor.fetchall()
        print(f"\n📋 Tables in database:")
        for table in tables:
            print(f"   - {table[0]}")
        
        cursor.close()
        conn.close()
        return True
        
    except pymysql.Error as e:
        print(f"\n❌ MySQL Error: {e}")
        return False
    except FileNotFoundError:
        print(f"\n❌ Error: database_schema.sql not found in current directory")
        print(f"   Make sure you're running from: E:\\Hackathon\\backend")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
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
