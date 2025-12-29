"""
API routes for IOP measurements and pressure tracking
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from app.database import get_db
from app.models import IOPMeasurement, Patient, TargetPressure
from app.schemas import IOPMeasurementCreate, IOPMeasurementResponse
from app.risk_engine import RiskEngine

router = APIRouter(prefix="/api/measurements", tags=["measurements"])

@router.post("/{patient_id}", response_model=IOPMeasurementResponse, status_code=status.HTTP_201_CREATED)
def record_iop_measurement(patient_id: int, measurement: IOPMeasurementCreate, db: Session = Depends(get_db)):
    """
    Record a new IOP measurement for a patient.
    Automatically evaluates pressure status against target.
    """
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    # Get current target pressures
    target = db.query(TargetPressure).filter(
        TargetPressure.patient_id == patient_id,
        TargetPressure.is_current == "YES"
    ).first()
    
    # Evaluate pressure status
    pressure_status_od = "UNKNOWN"
    pressure_status_os = "UNKNOWN"
    
    if target and measurement.iop_od:
        status_od, _ = RiskEngine.evaluate_iop_status(measurement.iop_od, target.target_iop_od)
        pressure_status_od = status_od
    
    if target and measurement.iop_os:
        status_os, _ = RiskEngine.evaluate_iop_status(measurement.iop_os, target.target_iop_os)
        pressure_status_os = status_os
    
    # Create measurement record
    db_measurement = IOPMeasurement(
        patient_id=patient_id,
        iop_od=measurement.iop_od,
        iop_os=measurement.iop_os,
        measurement_date=measurement.measurement_date,
        measured_by=measurement.measured_by,
        device_type=measurement.device_type,
        oct_rnfl_od=measurement.oct_rnfl_od,
        oct_rnfl_os=measurement.oct_rnfl_os,
        vf_md_od=measurement.vf_md_od,
        vf_md_os=measurement.vf_md_os,
        pressure_status_od=pressure_status_od,
        pressure_status_os=pressure_status_os,
        clinical_notes=measurement.clinical_notes
    )
    
    db.add(db_measurement)
    db.commit()
    db.refresh(db_measurement)
    return db_measurement

@router.get("/{patient_id}", response_model=List[IOPMeasurementResponse])
def get_patient_measurements(
    patient_id: int,
    days: int = 365,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get IOP measurements for a patient within specified days.
    Default: last 365 days
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    measurements = db.query(IOPMeasurement).filter(
        IOPMeasurement.patient_id == patient_id,
        IOPMeasurement.measurement_date >= cutoff_date
    ).order_by(IOPMeasurement.measurement_date.desc()).limit(limit).all()
    
    return measurements

@router.get("/{patient_id}/latest", response_model=IOPMeasurementResponse)
def get_latest_measurement(patient_id: int, db: Session = Depends(get_db)):
    """
    Get the latest IOP measurement for a patient.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    latest = db.query(IOPMeasurement).filter(
        IOPMeasurement.patient_id == patient_id
    ).order_by(IOPMeasurement.measurement_date.desc()).first()
    
    if not latest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No measurements found for patient {patient_id}"
        )
    
    return latest

@router.get("/{patient_id}/trend", response_model=dict)
def get_pressure_trend(
    patient_id: int,
    days: int = 365,
    db: Session = Depends(get_db)
):
    """
    Get IOP trend data for chart visualization.
    Returns dates and IOP values for both eyes.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    measurements = db.query(IOPMeasurement).filter(
        IOPMeasurement.patient_id == patient_id,
        IOPMeasurement.measurement_date >= cutoff_date
    ).order_by(IOPMeasurement.measurement_date).all()
    
    dates = []
    iop_od_values = []
    iop_os_values = []
    
    for m in measurements:
        dates.append(m.measurement_date.isoformat())
        iop_od_values.append(m.iop_od)
        iop_os_values.append(m.iop_os)
    
    # Get target for reference
    target = db.query(TargetPressure).filter(
        TargetPressure.patient_id == patient_id,
        TargetPressure.is_current == "YES"
    ).first()
    
    return {
        "dates": dates,
        "iop_od": iop_od_values,
        "iop_os": iop_os_values,
        "target_od": target.target_iop_od if target else None,
        "target_os": target.target_iop_os if target else None,
        "total_measurements": len(measurements)
    }
