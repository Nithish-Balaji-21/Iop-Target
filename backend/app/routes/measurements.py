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

@router.get("/{patient_id}/baseline", response_model=dict)
def get_baseline_iop(patient_id: int, db: Session = Depends(get_db)):
    """
    Get baseline (untreated) IOP for a patient.
    Used for Target IOP calculation.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    # Check if patient has stored baseline IOP
    if patient.baseline_iop_od and patient.baseline_iop_os:
        return {
            "baseline_iop_od": patient.baseline_iop_od,
            "baseline_iop_os": patient.baseline_iop_os,
            "source": "patient_record"
        }
    
    # Otherwise get first measurement (untreated baseline)
    first_measurement = db.query(IOPMeasurement).filter(
        IOPMeasurement.patient_id == patient_id
    ).order_by(IOPMeasurement.measurement_date.asc()).first()
    
    if first_measurement:
        return {
            "baseline_iop_od": first_measurement.iop_od or 21,
            "baseline_iop_os": first_measurement.iop_os or 21,
            "source": "first_measurement",
            "measurement_date": first_measurement.measurement_date.isoformat() if first_measurement.measurement_date else None
        }
    
    # Return defaults if no data
    return {
        "baseline_iop_od": 21,
        "baseline_iop_os": 21,
        "source": "default"
    }


@router.get("/{patient_id}/latest", response_model=dict)
def get_latest_measurement(patient_id: int, db: Session = Depends(get_db)):
    """
    Get the latest IOP measurement for a patient.
    Includes 3-month validity check.
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
    
    # Calculate days since measurement
    now = datetime.utcnow()
    days_since = (now - latest.measurement_date).days
    is_valid = days_since <= 90  # 3 months = ~90 days
    
    return {
        "id": latest.id,
        "patient_id": latest.patient_id,
        "iop_od": latest.iop_od,
        "iop_os": latest.iop_os,
        "measurement_date": latest.measurement_date.isoformat(),
        "measured_by": latest.measured_by,
        "device_type": latest.device_type,
        "oct_rnfl_od": latest.oct_rnfl_od,
        "oct_rnfl_os": latest.oct_rnfl_os,
        "vf_md_od": latest.vf_md_od,
        "vf_md_os": latest.vf_md_os,
        "clinical_notes": latest.clinical_notes,
        "pressure_status_od": latest.pressure_status_od,
        "pressure_status_os": latest.pressure_status_os,
        "created_at": latest.created_at.isoformat(),
        "updated_at": latest.updated_at.isoformat(),
        # 3-month validity check
        "is_valid": is_valid,
        "days_since_measurement": days_since,
        "needs_new_measurement": not is_valid,
        "validity_message": (
            "Measurement is current" if is_valid 
            else f"⚠️ Measurement is {days_since} days old. New measurement required (>90 days)."
        )
    }

@router.get("/{patient_id}/validity-check", response_model=dict)
def check_measurement_validity(patient_id: int, db: Session = Depends(get_db)):
    """
    Check if patient needs a new measurement (3-month rule).
    Returns reminder status for the UI.
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
        return {
            "has_measurement": False,
            "needs_new_measurement": True,
            "show_reminder": True,
            "reminder_message": "⚠️ No measurements recorded. Please take initial IOP measurement.",
            "days_since_measurement": None
        }
    
    now = datetime.utcnow()
    days_since = (now - latest.measurement_date).days
    is_valid = days_since <= 90
    
    # Calculate when next measurement is due
    days_until_due = 90 - days_since
    
    return {
        "has_measurement": True,
        "last_measurement_date": latest.measurement_date.isoformat(),
        "days_since_measurement": days_since,
        "is_valid": is_valid,
        "needs_new_measurement": not is_valid,
        "show_reminder": not is_valid,
        "days_until_due": max(0, days_until_due),
        "reminder_message": (
            None if is_valid
            else f"⚠️ Last measurement was {days_since} days ago. New measurement required for accurate assessment."
        ),
        "last_iop_od": latest.iop_od,
        "last_iop_os": latest.iop_os
    }

@router.get("/{patient_id}/baseline", response_model=dict)
def get_baseline_iop(patient_id: int, db: Session = Depends(get_db)):
    """
    Get the baseline (first untreated) IOP for a patient.
    This is the patient's first recorded IOP measurement which represents
    their untreated intraocular pressure.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    # First check if baseline is stored in patient record
    if patient.baseline_iop_od is not None and patient.baseline_iop_os is not None:
        return {
            "patient_id": patient_id,
            "baseline_iop_od": patient.baseline_iop_od,
            "baseline_iop_os": patient.baseline_iop_os,
            "source": "stored_baseline",
            "message": "Using stored baseline (first untreated IOP)"
        }
    
    # Otherwise, get the first recorded measurement
    first_measurement = db.query(IOPMeasurement).filter(
        IOPMeasurement.patient_id == patient_id
    ).order_by(IOPMeasurement.measurement_date.asc()).first()
    
    if not first_measurement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No measurements found for patient {patient_id}. Cannot determine baseline IOP."
        )
    
    return {
        "patient_id": patient_id,
        "baseline_iop_od": first_measurement.iop_od,
        "baseline_iop_os": first_measurement.iop_os,
        "first_measurement_date": first_measurement.measurement_date.isoformat(),
        "source": "first_measurement",
        "message": "Using first recorded measurement as baseline (untreated IOP)"
    }


@router.put("/{patient_id}/baseline", response_model=dict)
def set_baseline_iop(
    patient_id: int,
    baseline_od: float,
    baseline_os: float,
    db: Session = Depends(get_db)
):
    """
    Manually set the baseline (first untreated) IOP for a patient.
    Use this when the patient's first untreated IOP values are known
    but differ from the first recorded measurement.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    patient.baseline_iop_od = baseline_od
    patient.baseline_iop_os = baseline_os
    db.commit()
    db.refresh(patient)
    
    return {
        "patient_id": patient_id,
        "baseline_iop_od": patient.baseline_iop_od,
        "baseline_iop_os": patient.baseline_iop_os,
        "message": "Baseline IOP updated successfully"
    }


@router.get("/{patient_id}/trend", response_model=dict)
def get_pressure_trend(
    patient_id: int,
    days: int = 365,
    db: Session = Depends(get_db)
):
    """
    Get IOP trend data for chart visualization.
    Returns dates and IOP values for both eyes separately.
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
    
    # Get target for reference (now with per-eye data)
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
        # Additional target data for enhanced charts
        "calculated_target_od": target.calculated_target_od if target else None,
        "calculated_target_os": target.calculated_target_os if target else None,
        "upper_cap_od": target.upper_cap_od if target else None,
        "upper_cap_os": target.upper_cap_os if target else None,
        "is_overridden_od": target.is_overridden_od if target else None,
        "is_overridden_os": target.is_overridden_os if target else None,
        "glaucoma_stage_od": target.glaucoma_stage_od if target else None,
        "glaucoma_stage_os": target.glaucoma_stage_os if target else None,
        "total_measurements": len(measurements)
    }
