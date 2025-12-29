#!/usr/bin/env python3
"""Seed database with sample data for testing"""
import os
import sys
from datetime import datetime, timedelta
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import Patient, TargetPressure, IOPMeasurement, Visit

db = SessionLocal()

# Clear existing data
db.query(IOPMeasurement).delete()
db.query(Visit).delete()
db.commit()

# Sample measurements for Patient 1 (John Doe)
measurements_p1 = [
    IOPMeasurement(
        patient_id=1,
        iop_od=16.5,
        iop_os=17.2,
        measurement_date=datetime.utcnow() - timedelta(days=30),
        measured_by="Tech A",
        device_type="Tonometry",
        oct_rnfl_od=85,
        oct_rnfl_os=87,
        vf_md_od=-2.5,
        vf_md_os=-2.8,
        pressure_status_od="ABOVE_TARGET",
        pressure_status_os="ABOVE_TARGET"
    ),
    IOPMeasurement(
        patient_id=1,
        iop_od=15.8,
        iop_os=16.5,
        measurement_date=datetime.utcnow() - timedelta(days=15),
        measured_by="Tech B",
        device_type="Tonometry",
        oct_rnfl_od=84,
        oct_rnfl_os=86,
        vf_md_od=-2.6,
        vf_md_os=-2.9,
        pressure_status_od="CONTROLLED",
        pressure_status_os="CONTROLLED"
    ),
    IOPMeasurement(
        patient_id=1,
        iop_od=14.9,
        iop_os=15.8,
        measurement_date=datetime.utcnow(),
        measured_by="Tech A",
        device_type="Tonometry",
        oct_rnfl_od=83,
        oct_rnfl_os=85,
        vf_md_od=-2.7,
        vf_md_os=-3.0,
        pressure_status_od="CONTROLLED",
        pressure_status_os="CONTROLLED"
    )
]

# Sample measurements for Patient 2 (Jane Smith)
measurements_p2 = [
    IOPMeasurement(
        patient_id=2,
        iop_od=17.2,
        iop_os=17.8,
        measurement_date=datetime.utcnow() - timedelta(days=45),
        measured_by="Tech C",
        device_type="Tonometry",
        oct_rnfl_od=92,
        oct_rnfl_os=94,
        vf_md_od=-1.2,
        vf_md_os=-1.5,
        pressure_status_od="CONTROLLED",
        pressure_status_os="CONTROLLED"
    ),
    IOPMeasurement(
        patient_id=2,
        iop_od=18.5,
        iop_os=19.2,
        measurement_date=datetime.utcnow() - timedelta(days=20),
        measured_by="Tech B",
        device_type="Tonometry",
        oct_rnfl_od=91,
        oct_rnfl_os=93,
        vf_md_od=-1.3,
        vf_md_os=-1.6,
        pressure_status_od="CONTROLLED",
        pressure_status_os="ABOVE_TARGET"
    ),
    IOPMeasurement(
        patient_id=2,
        iop_od=17.8,
        iop_os=18.2,
        measurement_date=datetime.utcnow(),
        measured_by="Tech A",
        device_type="Tonometry",
        oct_rnfl_od=90,
        oct_rnfl_os=92,
        vf_md_od=-1.4,
        vf_md_os=-1.7,
        pressure_status_od="CONTROLLED",
        pressure_status_os="CONTROLLED"
    )
]

# Sample measurements for Patient 3 (Robert Brown)
measurements_p3 = [
    IOPMeasurement(
        patient_id=3,
        iop_od=11.5,
        iop_os=10.8,
        measurement_date=datetime.utcnow() - timedelta(days=30),
        measured_by="Tech A",
        device_type="Tonometry",
        oct_rnfl_od=65,
        oct_rnfl_os=62,
        vf_md_od=-8.2,
        vf_md_os=-8.5,
        pressure_status_od="CONTROLLED",
        pressure_status_os="CONTROLLED"
    ),
    IOPMeasurement(
        patient_id=3,
        iop_od=13.2,
        iop_os=12.5,
        measurement_date=datetime.utcnow(),
        measured_by="Tech C",
        device_type="Tonometry",
        oct_rnfl_od=63,
        oct_rnfl_os=60,
        vf_md_od=-8.5,
        vf_md_os=-8.8,
        pressure_status_od="CRITICAL",
        pressure_status_os="CRITICAL"
    )
]

# Add measurements
for m in measurements_p1 + measurements_p2 + measurements_p3:
    db.add(m)
db.commit()

# Sample visits
visits = [
    Visit(
        patient_id=1,
        visit_date=datetime.utcnow() - timedelta(days=20),
        visit_type="ROUTINE",
        risk_level="MODERATE",
        risk_score=45,
        recommended_followup_days=30,
        findings="IOP above target in both eyes, RNFL stable",
        treatment_changes="Increased drops frequency",
        created_by="Dr. Smith"
    ),
    Visit(
        patient_id=1,
        visit_date=datetime.utcnow(),
        visit_type="ROUTINE",
        risk_level="LOW",
        risk_score=25,
        recommended_followup_days=60,
        findings="IOP well controlled, no progression",
        treatment_changes="Continue current regimen",
        created_by="Dr. Smith"
    ),
    Visit(
        patient_id=2,
        visit_date=datetime.utcnow() - timedelta(days=10),
        visit_type="ROUTINE",
        risk_level="LOW",
        risk_score=20,
        recommended_followup_days=90,
        findings="Stable, good compliance",
        treatment_changes="No changes",
        created_by="Dr. Johnson"
    ),
    Visit(
        patient_id=3,
        visit_date=datetime.utcnow() - timedelta(days=5),
        visit_type="URGENT",
        risk_level="HIGH",
        risk_score=85,
        recommended_followup_days=7,
        findings="IOP critical, severe VF loss",
        treatment_changes="Added 4th agent, scheduled laser",
        created_by="Dr. Williams"
    )
]

for v in visits:
    db.add(v)
db.commit()

print("✓ Measurements seeded:")
for p_id in [1, 2, 3]:
    count = db.query(IOPMeasurement).filter(IOPMeasurement.patient_id == p_id).count()
    print(f"  - Patient {p_id}: {count} measurements")

print("\n✓ Visits seeded:")
for p_id in [1, 2, 3]:
    count = db.query(Visit).filter(Visit.patient_id == p_id).count()
    print(f"  - Patient {p_id}: {count} visits")

db.close()
print("\n✓ Database seeding complete!")
