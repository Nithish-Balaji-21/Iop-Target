"""
API routes for target pressure management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import TargetPressure, Patient
from app.schemas import TargetPressureCreate, TargetPressureUpdate, TargetPressureResponse
from app.jampel_calculator import JampelCalculator, RiskLevel

router = APIRouter(prefix="/api/targets", tags=["targets"])

@router.post("/{patient_id}", response_model=TargetPressureResponse, status_code=status.HTTP_201_CREATED)
def set_target_pressure(patient_id: int, target: TargetPressureCreate, db: Session = Depends(get_db)):
    """
    Set or update target IOP for a patient.
    Automatically invalidates previous targets for this patient.
    """
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    # Invalidate previous targets
    previous_targets = db.query(TargetPressure).filter(
        TargetPressure.patient_id == patient_id,
        TargetPressure.is_current == "YES"
    ).all()
    
    for prev_target in previous_targets:
        prev_target.is_current = "NO"
        prev_target.valid_to = datetime.utcnow()
    
    # Create new target
    db_target = TargetPressure(
        patient_id=patient_id,
        target_iop_od=target.target_iop_od,
        target_iop_os=target.target_iop_os,
        min_iop_od=target.min_iop_od,
        max_iop_od=target.max_iop_od,
        min_iop_os=target.min_iop_os,
        max_iop_os=target.max_iop_os,
        rationale=target.rationale,
        set_by=target.set_by,
        is_current="YES"
    )
    
    db.add(db_target)
    db.commit()
    db.refresh(db_target)
    return db_target

@router.get("/{patient_id}/current", response_model=TargetPressureResponse)
def get_current_target(patient_id: int, db: Session = Depends(get_db)):
    """
    Get the current active target pressure for a patient.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    target = db.query(TargetPressure).filter(
        TargetPressure.patient_id == patient_id,
        TargetPressure.is_current == "YES"
    ).first()
    
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active target found for patient {patient_id}"
        )
    
    return target

@router.get("/{patient_id}/history", response_model=List[TargetPressureResponse])
def get_target_history(patient_id: int, db: Session = Depends(get_db)):
    """
    Get all target pressure records for a patient (including historical).
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    targets = db.query(TargetPressure).filter(
        TargetPressure.patient_id == patient_id
    ).order_by(TargetPressure.valid_from.desc()).all()
    
    return targets

@router.put("/{target_id}", response_model=TargetPressureResponse)
def update_target_pressure(
    target_id: int,
    target_update: TargetPressureUpdate,
    db: Session = Depends(get_db)
):
    """
    Update target pressure values.
    """
    target = db.query(TargetPressure).filter(TargetPressure.id == target_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target with ID {target_id} not found"
        )
    
    # Only allow updates to current targets
    if target.is_current != "YES":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update historical targets"
        )
    
    update_data = target_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(target, key, value)
    
    target.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(target)
    return target

@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_target(target_id: int, db: Session = Depends(get_db)):
    """
    Deactivate a target (mark as historical).
    """
    target = db.query(TargetPressure).filter(TargetPressure.id == target_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target with ID {target_id} not found"
        )
    
    if target.is_current == "YES":
        target.is_current = "NO"
        target.valid_to = datetime.utcnow()
        db.commit()
    
    return None

@router.post("/{patient_id}/calculate-jampel", response_model=dict)
def calculate_target_jampel(
    patient_id: int,
    baseline_iop_od: float,
    baseline_iop_os: float,
    disease_stage: str = "Early",
    disease_severity: str = "Mild",
    risk_factors: Optional[dict] = None,
    db: Session = Depends(get_db)
):
    """
    Calculate target IOP using Jampel's formula based on:
    - HD Jampel, 1997: "Target pressure in glaucoma therapy"
    - International guidelines (AAO, EGS, WGA, NICE, Canadian, Southeast Asia)
    
    Risk factors (optional):
    {
        "baseline_iop_high": "HIGH|MODERATE|LOW",
        "age_advanced": "HIGH|MODERATE|LOW",
        "family_history": "HIGH|MODERATE|LOW",
        "ethnicity_african_descent": "HIGH|MODERATE|LOW",
        "central_corneal_thickness_thin": "HIGH|MODERATE|LOW",
        "optic_disc_size_small": "HIGH|MODERATE|LOW",
        "vertical_cup_disc_ratio_large": "HIGH|MODERATE|LOW",
        "pseudoexfoliation_syndrome": "HIGH|LOW",
        "pigment_dispersion_syndrome": "HIGH|LOW",
        "previous_ischemic_events": "HIGH|MODERATE|LOW",
        "myopia_high": "HIGH|MODERATE|LOW",
        "diabetes": "HIGH|MODERATE|LOW",
        "systemic_hypertension": "HIGH|MODERATE|LOW"
    }
    
    Disease Stage: "Early", "Moderate", "Advanced"
    Disease Severity: "Mild", "Moderate", "Severe"
    """
    
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    # Default risk factors if none provided
    if risk_factors is None:
        risk_factors = {}
    
    # Convert string risk levels to enum
    converted_factors = {}
    for key, value in risk_factors.items():
        if isinstance(value, str):
            try:
                converted_factors[key] = RiskLevel[value.upper()]
            except KeyError:
                converted_factors[key] = RiskLevel.LOW
        else:
            converted_factors[key] = value
    
    # Calculate using Jampel's formula
    calculation = JampelCalculator.calculate_complete_target(
        baseline_iop_od=baseline_iop_od,
        baseline_iop_os=baseline_iop_os,
        risk_factors=converted_factors,
        disease_stage=disease_stage,
        disease_severity=disease_severity
    )
    
    return {
        "patient_id": patient_id,
        "calculation_method": "Jampel Formula (HD Jampel, 1997)",
        "guidelines": [
            "American Academy of Ophthalmology (AAO)",
            "European Glaucoma Society (EGS)",
            "World Glaucoma Association (WGA)",
            "UK NICE Guidelines",
            "Canadian Ophthalmological Society",
            "Southeast Asia Glaucoma Interest Group"
        ],
        "calculation": calculation,
        "clinical_interpretation": (
            f"Risk Grade: {calculation['risk_grade']} ({calculation['total_risk_points']} points)\n"
            f"Disease Stage: {calculation['disease_stage']}\n"
            f"Disease Severity: {calculation['disease_severity']}\n"
            f"\nRight Eye Target: {calculation['right_eye']['target']} mmHg "
            f"(range: {calculation['right_eye']['min_target']}-{calculation['right_eye']['max_target']})\n"
            f"Left Eye Target: {calculation['left_eye']['target']} mmHg "
            f"(range: {calculation['left_eye']['min_target']}-{calculation['left_eye']['max_target']})\n"
            f"\nRecommendation: {calculation['recommendation']}"
        )
    }

