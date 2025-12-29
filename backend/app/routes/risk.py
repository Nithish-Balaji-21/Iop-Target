"""
API routes for risk assessment and clinical decision support
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import Patient, IOPMeasurement, TargetPressure, Visit
from app.schemas import VisitCreate, VisitResponse, RiskAssessmentResponse
from app.risk_engine import RiskEngine

router = APIRouter(prefix="/api/risk", tags=["risk-assessment"])

def calculate_pressure_fluctuation(measurements: List[IOPMeasurement]) -> float:
    """Calculate IOP fluctuation from recent measurements"""
    if len(measurements) < 2:
        return 0.0
    
    values = []
    for m in measurements:
        if m.iop_od:
            values.append(m.iop_od)
        if m.iop_os:
            values.append(m.iop_os)
    
    if len(values) < 2:
        return 0.0
    
    avg = sum(values) / len(values)
    variance = sum((x - avg) ** 2 for x in values) / len(values)
    return variance ** 0.5  # Standard deviation

@router.post("/{patient_id}/assess", response_model=RiskAssessmentResponse)
def assess_patient_risk(
    patient_id: int,
    medication_adherence: str = "GOOD",
    db: Session = Depends(get_db)
):
    """
    Perform automated risk stratification for a patient.
    Evaluates: IOP control, RNFL progression, VF progression, disease severity.
    
    Returns:
    - Risk level (LOW, MODERATE, HIGH)
    - Risk score (0-100)
    - Detailed reasons
    - Recommended follow-up interval
    """
    
    # Get patient
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    # Get current target
    target = db.query(TargetPressure).filter(
        TargetPressure.patient_id == patient_id,
        TargetPressure.is_current == "YES"
    ).first()
    
    if not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No target pressure set for patient {patient_id}"
        )
    
    # Get recent measurements (last 6 months)
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=180)
    measurements = db.query(IOPMeasurement).filter(
        IOPMeasurement.patient_id == patient_id,
        IOPMeasurement.measurement_date >= cutoff
    ).order_by(IOPMeasurement.measurement_date.desc()).all()
    
    if not measurements:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No measurements available for patient {patient_id}"
        )
    
    latest = measurements[0]
    
    # ===== EVALUATE IOP CONTROL =====
    iop_status_od = RiskEngine.WITHIN_TARGET
    iop_severity_od = 0
    if latest.iop_od:
        iop_status_od, iop_severity_od = RiskEngine.evaluate_iop_status(
            latest.iop_od, target.target_iop_od
        )
    
    iop_status_os = RiskEngine.WITHIN_TARGET
    iop_severity_os = 0
    if latest.iop_os:
        iop_status_os, iop_severity_os = RiskEngine.evaluate_iop_status(
            latest.iop_os, target.target_iop_os
        )
    
    # Take worst of both eyes for composite score
    iop_status = iop_status_od if iop_severity_od >= iop_severity_os else iop_status_os
    iop_severity = max(iop_severity_od, iop_severity_os)
    
    # ===== EVALUATE RNFL PROGRESSION =====
    rnfl_status = "BASELINE"
    rnfl_severity = 0
    if latest.oct_rnfl_od and len(measurements) > 1:
        rnfl_history = [m.oct_rnfl_od for m in measurements if m.oct_rnfl_od]
        if len(rnfl_history) > 1:
            rnfl_status, rnfl_severity = RiskEngine.assess_rnfl_progression(
                latest.oct_rnfl_od, rnfl_history[1:], months_between_visits=6
            )
    
    # ===== EVALUATE VF PROGRESSION =====
    vf_status = "BASELINE"
    vf_severity = 0
    if latest.vf_md_od and len(measurements) > 1:
        vf_history = [m.vf_md_od for m in measurements if m.vf_md_od]
        if len(vf_history) > 1:
            vf_status, vf_severity = RiskEngine.assess_vf_progression(
                latest.vf_md_od, vf_history[1:], months_between_visits=6
            )
    
    # ===== CALCULATE PRESSURE FLUCTUATION =====
    pressure_fluctuation = calculate_pressure_fluctuation(measurements[:6])
    
    # ===== CALCULATE OVERALL RISK =====
    risk_level, risk_score, reasons = RiskEngine.calculate_risk_score(
        iop_status=iop_status,
        iop_severity=iop_severity,
        rnfl_status=rnfl_status,
        rnfl_severity=rnfl_severity,
        vf_status=vf_status,
        vf_severity=vf_severity,
        disease_severity=patient.disease_severity or "MODERATE",
        pressure_fluctuation=pressure_fluctuation,
        medication_adherence=medication_adherence
    )
    
    # ===== GET FOLLOWUP RECOMMENDATION =====
    followup_days, followup_actions = RiskEngine.recommend_followup(
        risk_level, patient.disease_severity or "MODERATE"
    )
    
    return RiskAssessmentResponse(
        patient_id=patient_id,
        risk_level=risk_level,
        risk_score=risk_score,
        reasons=reasons,
        recommended_followup_days=followup_days,
        recommended_actions=followup_actions
    )

@router.post("/{patient_id}/visit", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
def create_visit_with_risk(
    patient_id: int,
    visit: VisitCreate,
    db: Session = Depends(get_db)
):
    """
    Create a visit record and automatically perform risk assessment.
    Stores risk level and recommended follow-up.
    """
    
    # Perform risk assessment
    risk_assessment = assess_patient_risk(patient_id, "GOOD", db)
    
    # Create visit record
    db_visit = Visit(
        patient_id=patient_id,
        visit_date=visit.visit_date,
        visit_type=visit.visit_type,
        risk_level=risk_assessment.risk_level,
        risk_score=risk_assessment.risk_score,
        recommended_followup_days=risk_assessment.recommended_followup_days,
        findings=visit.findings,
        treatment_changes=visit.treatment_changes,
        doctor_notes=visit.doctor_notes,
        created_by=visit.created_by
    )
    
    db.add(db_visit)
    db.commit()
    db.refresh(db_visit)
    return db_visit

@router.get("/{patient_id}/visits", response_model=List[VisitResponse])
def get_patient_visits(patient_id: int, limit: int = 20, db: Session = Depends(get_db)):
    """
    Get patient visit history with risk assessments.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    visits = db.query(Visit).filter(
        Visit.patient_id == patient_id
    ).order_by(Visit.visit_date.desc()).limit(limit).all()
    
    return visits

@router.get("/{patient_id}/risk-summary", response_model=dict)
def get_risk_summary(patient_id: int, db: Session = Depends(get_db)):
    """
    Get comprehensive risk profile and trend.
    Shows current risk and historical trend.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found"
        )
    
    try:
        # Current risk
        current_risk = assess_patient_risk(patient_id, "GOOD", db)
    except Exception as e:
        # If risk assessment fails, return basic info instead of 500
        return {
            "patient_id": patient_id,
            "error": str(e),
            "message": "Risk assessment failed - ensure patient has measurements and target pressure set",
            "current_risk": {
                "risk_level": "UNKNOWN",
                "risk_score": 0,
                "reasons": ["Insufficient data for risk calculation"],
                "recommended_followup_days": 30,
                "recommended_actions": []
            },
            "risk_trend": [],
            "trend_direction": "unknown"
        }
    
    # Historical risk from visits
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=365)
    visits = db.query(Visit).filter(
        Visit.patient_id == patient_id,
        Visit.visit_date >= cutoff
    ).order_by(Visit.visit_date.desc()).all()
    
    risk_trend = [
        {
            "date": v.visit_date.isoformat(),
            "risk_level": v.risk_level,
            "risk_score": v.risk_score
        }
        for v in visits
    ]
    
    return {
        "current_risk": {
            "risk_level": current_risk.risk_level,
            "risk_score": current_risk.risk_score,
            "reasons": current_risk.reasons,
            "recommended_followup_days": current_risk.recommended_followup_days,
            "recommended_actions": current_risk.recommended_actions
        },
        "risk_trend": risk_trend,
        "trend_direction": "improving" if len(risk_trend) > 1 and risk_trend[0]["risk_score"] < risk_trend[-1]["risk_score"] else "stable" if len(risk_trend) < 2 else "worsening"
    }
