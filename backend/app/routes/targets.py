"""
API routes for target pressure management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import TargetPressure, Patient, IOPMeasurement
from app.schemas import TargetPressureCreate, TargetPressureUpdate, TargetPressureResponse
from app.trbs_calculator import TRBSCalculator, calculate_target_iop

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

@router.post("/{patient_id}/calculate-trbs", response_model=dict)
def calculate_target_trbs(
    patient_id: int,
    baseline_iop_od: float,
    baseline_iop_os: float,
    risk_factors: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db)
):
    """
    Calculate target IOP using Total Risk Burden Score (TRBS).
    CALCULATES SEPARATELY FOR EACH EYE based on risk factors.
    
    Risk factors can be per-eye:
    {
        "age": "over_70" | "50_to_70" | "under_50",
        "family_history": "absent" | "present",
        // Per-eye structural (Domain B)
        "cdr_od": "0.5_or_less" | ..., "cdr_os": ...,
        "notching_od": ..., "notching_os": ...,
        "disc_hemorrhage_od": ..., "disc_hemorrhage_os": ...,
        // Per-eye functional (Domain C)
        "mean_deviation_od": ..., "mean_deviation_os": ...,
        "central_field_od": ..., "central_field_os": ...,
        // Per-eye ocular (Domain D)
        "cct_od": ..., "cct_os": ...,
        "ocular_modifiers_od": [...], "ocular_modifiers_os": [...],
        // Shared factors
        "systemic_factors": [...],
        "patient_factors": [...],
        "use_aggressive_reduction": true | false
    }
    
    Risk Tiers (based on TRBS score):
    - 0-6 (Low): 20-25% reduction
    - 7-12 (Moderate): 30-35% reduction
    - 13-18 (High): 40-45% reduction
    - 19-25 (Very High): ≥50% reduction
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
    
    # Calculate using TRBS formula (now per-eye)
    calculation = calculate_target_iop(
        baseline_iop_od=baseline_iop_od,
        baseline_iop_os=baseline_iop_os,
        risk_factors=risk_factors
    )
    
    # Get per-eye results
    od_result = calculation.get('od_result', {})
    os_result = calculation.get('os_result', {})
    
    return {
        "patient_id": patient_id,
        "calculation_method": "Total Risk Burden Score (TRBS) - Per Eye",
        "calculation": calculation,
        "per_eye_summary": {
            "od": {
                "trbs_score": od_result.get('trbs_score'),
                "risk_tier": od_result.get('risk_tier'),
                "reduction_applied": od_result.get('reduction_applied'),
                "baseline_iop": od_result.get('baseline_iop'),
                "calculated_target": od_result.get('calculated_target')
            },
            "os": {
                "trbs_score": os_result.get('trbs_score'),
                "risk_tier": os_result.get('risk_tier'),
                "reduction_applied": os_result.get('reduction_applied'),
                "baseline_iop": os_result.get('baseline_iop'),
                "calculated_target": os_result.get('calculated_target')
            }
        },
        "clinical_interpretation": (
            f"=== RIGHT EYE (OD) ===\n"
            f"TRBS Score: {od_result.get('trbs_score', 'N/A')}/25 ({od_result.get('risk_tier', 'N/A')} Risk)\n"
            f"Reduction: {od_result.get('reduction_applied', 'N/A')}%\n"
            f"Target: {od_result.get('baseline_iop', 'N/A')} → {od_result.get('calculated_target', 'N/A')} mmHg\n"
            f"\n=== LEFT EYE (OS) ===\n"
            f"TRBS Score: {os_result.get('trbs_score', 'N/A')}/25 ({os_result.get('risk_tier', 'N/A')} Risk)\n"
            f"Reduction: {os_result.get('reduction_applied', 'N/A')}%\n"
            f"Target: {os_result.get('baseline_iop', 'N/A')} → {os_result.get('calculated_target', 'N/A')} mmHg"
        )
    }


@router.post("/{patient_id}/save-with-override", response_model=dict)
def save_target_with_override(
    patient_id: int,
    # Calculated targets
    calculated_target_od: float,
    calculated_target_os: float,
    # Final targets (may be doctor-overridden)
    final_target_od: float,
    final_target_os: float,
    # Override tracking
    override_reason: Optional[str] = None,
    # TRBS data
    trbs_score_od: Optional[int] = None,
    trbs_score_os: Optional[int] = None,
    risk_tier_od: Optional[str] = None,
    risk_tier_os: Optional[str] = None,
    # Glaucoma stages at time of calculation
    glaucoma_stage_od: Optional[str] = None,
    glaucoma_stage_os: Optional[str] = None,
    # Upper caps applied
    upper_cap_od: Optional[int] = None,
    upper_cap_os: Optional[int] = None,
    # Baseline IOPs
    baseline_iop_od: Optional[float] = None,
    baseline_iop_os: Optional[float] = None,
    # Reduction percentages
    reduction_percentage_od: Optional[int] = None,
    reduction_percentage_os: Optional[int] = None,
    # Clinician
    set_by: Optional[str] = "Ophthalmologist",
    db: Session = Depends(get_db)
):
    """
    Save target IOP with doctor override support.
    Stores both calculated and final (potentially overridden) values.
    """
    
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    # Determine if overridden
    is_overridden_od = "YES" if abs(calculated_target_od - final_target_od) > 0.01 else "NO"
    is_overridden_os = "YES" if abs(calculated_target_os - final_target_os) > 0.01 else "NO"
    
    # Invalidate previous targets
    previous_targets = db.query(TargetPressure).filter(
        TargetPressure.patient_id == patient_id,
        TargetPressure.is_current == "YES"
    ).all()
    
    for prev_target in previous_targets:
        prev_target.is_current = "NO"
        prev_target.valid_to = datetime.utcnow()
    
    # Build rationale
    rationale_parts = []
    if trbs_score_od is not None:
        rationale_parts.append(f"OD: TRBS {trbs_score_od}/25 ({risk_tier_od}), {reduction_percentage_od}% reduction")
    if trbs_score_os is not None:
        rationale_parts.append(f"OS: TRBS {trbs_score_os}/25 ({risk_tier_os}), {reduction_percentage_os}% reduction")
    if is_overridden_od == "YES" or is_overridden_os == "YES":
        rationale_parts.append(f"Doctor Override: {override_reason or 'No reason provided'}")
    
    rationale = " | ".join(rationale_parts)
    
    # Create new target
    db_target = TargetPressure(
        patient_id=patient_id,
        # System calculated
        calculated_target_od=calculated_target_od,
        calculated_target_os=calculated_target_os,
        # Final (potentially overridden)
        target_iop_od=final_target_od,
        target_iop_os=final_target_os,
        # Override tracking
        is_overridden_od=is_overridden_od,
        is_overridden_os=is_overridden_os,
        override_reason=override_reason if (is_overridden_od == "YES" or is_overridden_os == "YES") else None,
        # TRBS data
        trbs_score_od=trbs_score_od,
        trbs_score_os=trbs_score_os,
        risk_tier_od=risk_tier_od,
        risk_tier_os=risk_tier_os,
        # Glaucoma stage at time of calculation
        glaucoma_stage_od=glaucoma_stage_od,
        glaucoma_stage_os=glaucoma_stage_os,
        # Upper caps
        upper_cap_od=upper_cap_od,
        upper_cap_os=upper_cap_os,
        # Baselines
        baseline_iop_od=baseline_iop_od,
        baseline_iop_os=baseline_iop_os,
        # Reduction percentages
        reduction_percentage_od=reduction_percentage_od,
        reduction_percentage_os=reduction_percentage_os,
        # Metadata
        rationale=rationale,
        set_by=set_by,
        is_current="YES"
    )
    
    db.add(db_target)
    db.commit()
    db.refresh(db_target)
    
    return {
        "success": True,
        "message": "Target IOP saved successfully",
        "target_id": db_target.id,
        "is_overridden_od": is_overridden_od,
        "is_overridden_os": is_overridden_os,
        "final_target_od": final_target_od,
        "final_target_os": final_target_os
    }


def get_age_tier(age: int) -> str:
    """Get age tier for comparison"""
    if age < 50:
        return "<50"
    elif age <= 60:
        return "50-60"
    elif age <= 70:
        return "61-70"
    elif age <= 80:
        return "71-80"
    else:
        return ">80"


def get_glaucoma_stage_from_md(md: float) -> str:
    """Determine glaucoma stage from Mean Deviation value"""
    if md is None:
        return "EARLY"
    md = abs(md)  # MD is typically negative
    if md <= 6:
        return "EARLY"
    elif md <= 12:
        return "MODERATE"
    elif md <= 20:
        return "ADVANCED"
    else:
        return "END_STAGE"


@router.get("/{patient_id}/recalculation-check", response_model=dict)
def check_recalculation_needed(patient_id: int, db: Session = Depends(get_db)):
    """
    Check if target IOP recalculation is needed based on:
    1. Last measurement > 90 days old
    2. Mean Deviation (VF MD) has changed significantly
    3. Patient age has moved to a new tier
    4. Risk factors have changed (glaucoma stage, disease severity)
    
    Returns reasons for recalculation if needed.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    # Get current target
    current_target = db.query(TargetPressure).filter(
        TargetPressure.patient_id == patient_id,
        TargetPressure.is_current == "YES"
    ).first()
    
    # If no target exists, recommend calculation
    if not current_target:
        return {
            "needs_recalculation": True,
            "reasons": [{
                "type": "NO_TARGET",
                "title": "No Target IOP Set",
                "description": "Target IOP has not been calculated yet. Please calculate target IOP using TRBS assessment.",
                "severity": "high"
            }],
            "has_target": False
        }
    
    reasons = []
    
    # Get latest measurement
    latest_measurement = db.query(IOPMeasurement).filter(
        IOPMeasurement.patient_id == patient_id
    ).order_by(IOPMeasurement.measurement_date.desc()).first()
    
    # 1. Check if last measurement is > 90 days old
    if latest_measurement:
        days_since = (datetime.utcnow() - latest_measurement.measurement_date).days
        if days_since > 90:
            reasons.append({
                "type": "MEASUREMENT_OUTDATED",
                "title": "Measurement Outdated",
                "description": f"Last measurement was {days_since} days ago. Target should be re-evaluated with current IOP data.",
                "severity": "medium",
                "days_since": days_since
            })
    
    # 2. Check if Mean Deviation has changed significantly
    # Compare current MD with MD when target was set (inferred from glaucoma stage)
    if latest_measurement:
        # Get the MD values from latest measurement
        current_md_od = latest_measurement.vf_md_od
        current_md_os = latest_measurement.vf_md_os
        
        # Get MD values when target was set (from glaucoma stage stored)
        target_stage_od = current_target.glaucoma_stage_od
        target_stage_os = current_target.glaucoma_stage_os
        
        # Derive current stage from current MD
        if current_md_od is not None:
            current_stage_od = get_glaucoma_stage_from_md(current_md_od)
            if target_stage_od and current_stage_od != target_stage_od:
                reasons.append({
                    "type": "MD_CHANGE_OD",
                    "title": "Visual Field Changed (Right Eye)",
                    "description": f"Mean Deviation has changed. Glaucoma stage: {target_stage_od} → {current_stage_od}. Current MD: {current_md_od:.1f} dB",
                    "severity": "high",
                    "previous_stage": target_stage_od,
                    "current_stage": current_stage_od,
                    "current_md": current_md_od
                })
        
        if current_md_os is not None:
            current_stage_os = get_glaucoma_stage_from_md(current_md_os)
            if target_stage_os and current_stage_os != target_stage_os:
                reasons.append({
                    "type": "MD_CHANGE_OS",
                    "title": "Visual Field Changed (Left Eye)",
                    "description": f"Mean Deviation has changed. Glaucoma stage: {target_stage_os} → {current_stage_os}. Current MD: {current_md_os:.1f} dB",
                    "severity": "high",
                    "previous_stage": target_stage_os,
                    "current_stage": current_stage_os,
                    "current_md": current_md_os
                })
    
    # 3. Check if patient age has moved to a new tier
    # Calculate age at target creation vs current age
    target_creation_date = current_target.valid_from or current_target.created_at
    if target_creation_date:
        years_since_target = (datetime.utcnow() - target_creation_date).days / 365.25
        age_at_target = int(patient.age - years_since_target)
        
        previous_tier = get_age_tier(age_at_target)
        current_tier = get_age_tier(patient.age)
        
        if previous_tier != current_tier:
            reasons.append({
                "type": "AGE_TIER_CHANGE",
                "title": "Age Tier Changed",
                "description": f"Patient's age has moved to a new risk tier: {previous_tier} → {current_tier}. Current age: {patient.age}",
                "severity": "medium",
                "previous_tier": previous_tier,
                "current_tier": current_tier
            })
    
    # 4. Check if patient glaucoma stage has changed from what was recorded
    if patient.glaucoma_stage_od != current_target.glaucoma_stage_od:
        reasons.append({
            "type": "STAGE_CHANGE_OD",
            "title": "Glaucoma Stage Updated (Right Eye)",
            "description": f"Patient's glaucoma stage has been updated: {current_target.glaucoma_stage_od or 'Not set'} → {patient.glaucoma_stage_od}",
            "severity": "high",
            "previous_stage": current_target.glaucoma_stage_od,
            "current_stage": patient.glaucoma_stage_od
        })
    
    if patient.glaucoma_stage_os != current_target.glaucoma_stage_os:
        reasons.append({
            "type": "STAGE_CHANGE_OS",
            "title": "Glaucoma Stage Updated (Left Eye)",
            "description": f"Patient's glaucoma stage has been updated: {current_target.glaucoma_stage_os or 'Not set'} → {patient.glaucoma_stage_os}",
            "severity": "high",
            "previous_stage": current_target.glaucoma_stage_os,
            "current_stage": patient.glaucoma_stage_os
        })
    
    # 5. Check target age (> 1 year old should be reviewed)
    if target_creation_date:
        target_age_days = (datetime.utcnow() - target_creation_date).days
        if target_age_days > 365:
            reasons.append({
                "type": "TARGET_OLD",
                "title": "Annual Review Recommended",
                "description": f"Target IOP was set {target_age_days // 30} months ago. Annual review is recommended.",
                "severity": "low",
                "target_age_days": target_age_days
            })
    
    return {
        "needs_recalculation": len(reasons) > 0,
        "reasons": reasons,
        "has_target": True,
        "target_set_date": current_target.valid_from.isoformat() if current_target.valid_from else None,
        "target_age_days": (datetime.utcnow() - current_target.valid_from).days if current_target.valid_from else None
    }
