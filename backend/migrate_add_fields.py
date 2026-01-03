"""
Migration script to add missing fields to glaucoma_risk_data table:
- rnfl_defect_od
- rnfl_defect_os  
- myopia_od
- myopia_os

Run this script to update the database schema.
"""
import os
import sys
from sqlalchemy import text
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine

load_dotenv()

def migrate():
    """Add missing columns to glaucoma_risk_data table"""
    print("🔄 Starting database migration...")
    
    with engine.connect() as conn:
        try:
            # Check if columns exist and add them if they don't
            columns_to_add = [
                ('rnfl_defect_od', 'VARCHAR(20)'),
                ('rnfl_defect_os', 'VARCHAR(20)'),
                ('myopia_od', 'VARCHAR(20)'),
                ('myopia_os', 'VARCHAR(20)')
            ]
            
            for column_name, column_type in columns_to_add:
                # Check if column exists
                check_query = text(f"""
                    SELECT COUNT(*) as count
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'glaucoma_risk_data'
                    AND COLUMN_NAME = '{column_name}'
                """)
                
                result = conn.execute(check_query)
                exists = result.fetchone()[0] > 0
                
                if not exists:
                    print(f"  ➕ Adding column: {column_name}")
                    alter_query = text(f"ALTER TABLE glaucoma_risk_data ADD COLUMN {column_name} {column_type}")
                    conn.execute(alter_query)
                    conn.commit()
                    print(f"  ✅ Added {column_name}")
                else:
                    print(f"  ✓ Column {column_name} already exists")
            
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    migrate()

