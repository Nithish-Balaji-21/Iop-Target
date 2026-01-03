#!/usr/bin/env python3
"""
Insert old IOP measurements (older than 90 days) for testing the 90-day alert popup
"""
import os
import sys
from datetime import datetime, timedelta

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

# Try to import, with helpful error message
try:
    from app.database import SessionLocal
    from app.models import Patient, IOPMeasurement
except ImportError as e:
    print("❌ Error importing modules. Make sure you're in the backend directory and dependencies are installed.")
    print(f"   Error: {e}")
    print("\n💡 Try running:")
    print("   cd backend")
    print("   pip install -r requirements.txt")
    print("   python insert_old_measurements.py")
    sys.exit(1)

db = SessionLocal()

def insert_old_measurements():
    """Insert old measurements for testing 90-day alert"""
    
    # Get all patients or create test patient
    patients = db.query(Patient).all()
    
    if not patients:
        print("❌ No patients found. Please create a patient first.")
        return
    
    print(f"📋 Found {len(patients)} patient(s)")
    print("\nSelect a patient to add old measurements:")
    for i, patient in enumerate(patients, 1):
        print(f"  {i}. {patient.name} (ID: {patient.id}, Patient ID: {patient.patient_id})")
    
    # Use first patient by default, or you can modify to select
    selected_patient = patients[0]
    print(f"\n✅ Using patient: {selected_patient.name} (ID: {selected_patient.id})")
    
    # Create measurements with different ages
    old_measurements = [
        {
            "days_ago": 95,  # Just over 90 days
            "iop_od": 22.0,
            "iop_os": 23.0,
            "description": "95 days ago - Should trigger 90-day alert"
        },
        {
            "days_ago": 120,  # 4 months old
            "iop_od": 21.5,
            "iop_os": 22.5,
            "description": "120 days ago - Very old"
        },
        {
            "days_ago": 180,  # 6 months old
            "iop_od": 20.0,
            "iop_os": 21.0,
            "description": "180 days ago - Extremely old"
        }
    ]
    
    print("\n📊 Creating old measurements:")
    created_count = 0
    
    for measurement_data in old_measurements:
        measurement_date = datetime.utcnow() - timedelta(days=measurement_data["days_ago"])
        
        # Check if measurement already exists for this date
        existing = db.query(IOPMeasurement).filter(
            IOPMeasurement.patient_id == selected_patient.id,
            IOPMeasurement.measurement_date >= measurement_date.replace(hour=0, minute=0, second=0),
            IOPMeasurement.measurement_date < measurement_date.replace(hour=23, minute=59, second=59)
        ).first()
        
        if existing:
            print(f"  ⚠️  Measurement already exists for {measurement_data['days_ago']} days ago - skipping")
            continue
        
        new_measurement = IOPMeasurement(
            patient_id=selected_patient.id,
            iop_od=measurement_data["iop_od"],
            iop_os=measurement_data["iop_os"],
            measurement_date=measurement_date,
            measured_by="Test System",
            device_type="Goldmann Tonometry",
            clinical_notes=f"Test measurement - {measurement_data['description']}"
        )
        
        db.add(new_measurement)
        created_count += 1
        print(f"  ✓ Created measurement from {measurement_data['days_ago']} days ago (OD: {measurement_data['iop_od']}, OS: {measurement_data['iop_os']})")
    
    if created_count > 0:
        db.commit()
        print(f"\n✅ Successfully created {created_count} old measurement(s)")
        print(f"\n📝 Next steps:")
        print(f"   1. Open the patient dashboard for: {selected_patient.name}")
        print(f"   2. The 90-day alert popup should appear automatically")
        print(f"   3. The popup will show that the measurement is 95+ days old")
    else:
        print("\n⚠️  No new measurements created (all already exist)")
    
    # Show current measurements for this patient
    print(f"\n📊 Current measurements for {selected_patient.name}:")
    all_measurements = db.query(IOPMeasurement).filter(
        IOPMeasurement.patient_id == selected_patient.id
    ).order_by(IOPMeasurement.measurement_date.desc()).all()
    
    if all_measurements:
        for m in all_measurements:
            days_ago = (datetime.utcnow() - m.measurement_date).days
            print(f"  - {m.measurement_date.strftime('%Y-%m-%d')} ({days_ago} days ago): OD={m.iop_od}, OS={m.iop_os}")
    else:
        print("  No measurements found")

if __name__ == "__main__":
    print("=" * 60)
    print("INSERT OLD MEASUREMENTS FOR 90-DAY ALERT TESTING")
    print("=" * 60)
    print()
    
    try:
        insert_old_measurements()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

