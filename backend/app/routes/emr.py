"""
EMR Routes
API endpoints for EMR records and glaucoma risk data extraction
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.models import Patient, EMRRecord, GlaucomaRiskData

router = APIRouter(
    prefix="/api/emr",
    tags=["EMR"]
)


# ============== Pydantic Models ==============

class EMRDataCreate(BaseModel):
    data: Dict[str, Any]
    created_by: Optional[str] = "System"


class EMRDataResponse(BaseModel):
    exists: bool
    id: Optional[int] = None
    data: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None


class BaselineIOPCreate(BaseModel):
    baseline_iop_od: Optional[float] = None
    baseline_iop_os: Optional[float] = None
    visit_type: str = "new"
    is_untreated: bool = True
    source: Optional[str] = "first_visit"  # 'first_visit' or 'pre_agm'
    on_agm: bool = False
    current_medications: Optional[list] = []


class GlaucomaRiskDataResponse(BaseModel):
    """Response model for glaucoma risk data"""
    # Domain A: Demographics
    age_range: Optional[str] = None
    family_history: str = "absent"
    
    # Domain B: Baseline IOP
    baseline_iop_od: Optional[float] = None
    baseline_iop_os: Optional[float] = None
    num_agm: str = "0"
    
    # Domain C: Structural
    cdr_od: Optional[str] = None
    notching_od: str = "absent"
    disc_hemorrhage_od: str = "absent"
    cdr_os: Optional[str] = None
    notching_os: str = "absent"
    disc_hemorrhage_os: str = "absent"
    
    # Domain D: Functional
    mean_deviation_od: str = "0_to_minus_6"
    central_field_od: str = "no"
    mean_deviation_os: str = "0_to_minus_6"
    central_field_os: str = "no"
    
    # Domain E: Ocular
    cct_od: str = "normal"
    pachymetry_od: Optional[int] = None
    ocular_modifiers_od: list = []
    cct_os: str = "normal"
    pachymetry_os: Optional[int] = None
    ocular_modifiers_os: list = []
    
    # Domain F & G
    systemic_factors: list = []
    patient_factors: list = []
    
    # Additional
    gonioscopy_od: Optional[str] = None
    gonioscopy_os: Optional[str] = None
    diagnosis_od: Optional[str] = None
    diagnosis_os: Optional[str] = None
    
    auto_extracted: bool = True
    manually_verified: bool = False


# ============== EMR Record Endpoints ==============

# IMPORTANT: Specific routes must come BEFORE generic /{patient_id}/{section_type} routes

@router.get("/{patient_id}/all")
def get_all_emr_records(patient_id: int, db: Session = Depends(get_db)):
    """Get all EMR records for a patient"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    records = db.query(EMRRecord).filter(EMRRecord.patient_id == patient_id).all()
    
    result = {}
    for record in records:
        result[record.section_type] = {
            "id": record.id,
            "data": record.data,
            "created_at": record.created_at.isoformat() if record.created_at else None,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            "created_by": record.created_by
        }
    
    return result


# ============== Baseline IOP Endpoint (BEFORE generic routes) ==============

@router.post("/{patient_id}/baseline-iop")
def save_baseline_iop(patient_id: int, baseline_data: BaselineIOPCreate, db: Session = Depends(get_db)):
    """
    Save baseline IOP from Complaints section (New Visit).
    This is used as the untreated baseline for Target IOP calculation.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Only update if values are provided
    if baseline_data.baseline_iop_od is not None:
        patient.baseline_iop_od = baseline_data.baseline_iop_od
    if baseline_data.baseline_iop_os is not None:
        patient.baseline_iop_os = baseline_data.baseline_iop_os
    
    # Also update risk data if values provided
    if baseline_data.baseline_iop_od is not None or baseline_data.baseline_iop_os is not None:
        risk_data = db.query(GlaucomaRiskData).filter(
            GlaucomaRiskData.patient_id == patient_id
        ).first()
        
        if not risk_data:
            risk_data = GlaucomaRiskData(
                patient_id=patient_id,
                age_range=get_age_range(patient.age),
                baseline_iop_od=baseline_data.baseline_iop_od,
                baseline_iop_os=baseline_data.baseline_iop_os
            )
            db.add(risk_data)
        else:
            if baseline_data.baseline_iop_od is not None:
                risk_data.baseline_iop_od = baseline_data.baseline_iop_od
            if baseline_data.baseline_iop_os is not None:
                risk_data.baseline_iop_os = baseline_data.baseline_iop_os
    
    db.commit()
    
    return {
        "message": "Baseline IOP saved successfully",
        "baseline_iop_od": patient.baseline_iop_od,
        "baseline_iop_os": patient.baseline_iop_os
    }


# ============== Glaucoma Risk Data Endpoints (BEFORE generic routes) ==============

@router.get("/{patient_id}/risk-factors")
def get_glaucoma_risk_factors(patient_id: int, db: Session = Depends(get_db)):
    """Get extracted glaucoma risk factors for Target IOP calculation"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    risk_data = db.query(GlaucomaRiskData).filter(
        GlaucomaRiskData.patient_id == patient_id
    ).first()
    
    if not risk_data:
        # Return default values with patient age
        age_range = get_age_range(patient.age) if patient.age else "50_to_70"
        return {
            "exists": False,
            "data": {
                "age_range": age_range,
                "family_history": "absent",
                "baseline_iop_od": patient.baseline_iop_od,
                "baseline_iop_os": patient.baseline_iop_os,
                "num_agm": "0",
                "cdr_od": "0.5_or_less",
                "notching_od": "absent",
                "disc_hemorrhage_od": "absent",
                "cdr_os": "0.5_or_less",
                "notching_os": "absent",
                "disc_hemorrhage_os": "absent",
                "mean_deviation_od": "0_to_minus_6",
                "central_field_od": "no",
                "mean_deviation_os": "0_to_minus_6",
                "central_field_os": "no",
                "cct_od": "normal",
                "cct_os": "normal",
                "ocular_modifiers_od": [],
                "ocular_modifiers_os": [],
                "systemic_factors": [],
                "patient_factors": [],
                "auto_extracted": False,
                "manually_verified": False
            }
        }
    
    return {
        "exists": True,
        "data": {
            "age_range": risk_data.age_range,
            "family_history": risk_data.family_history,
            "baseline_iop_od": risk_data.baseline_iop_od,
            "baseline_iop_os": risk_data.baseline_iop_os,
            "num_agm": risk_data.num_agm,
            "cdr_od": risk_data.cdr_od,
            "notching_od": risk_data.notching_od,
            "disc_hemorrhage_od": risk_data.disc_hemorrhage_od,
            "cdr_os": risk_data.cdr_os,
            "notching_os": risk_data.notching_os,
            "disc_hemorrhage_os": risk_data.disc_hemorrhage_os,
            "mean_deviation_od": risk_data.mean_deviation_od,
            "central_field_od": risk_data.central_field_od,
            "mean_deviation_os": risk_data.mean_deviation_os,
            "central_field_os": risk_data.central_field_os,
            "cct_od": risk_data.cct_od,
            "pachymetry_od": risk_data.pachymetry_od,
            "cct_os": risk_data.cct_os,
            "pachymetry_os": risk_data.pachymetry_os,
            "ocular_modifiers_od": risk_data.ocular_modifiers_od or [],
            "ocular_modifiers_os": risk_data.ocular_modifiers_os or [],
            "systemic_factors": risk_data.systemic_factors or [],
            "patient_factors": risk_data.patient_factors or [],
            "gonioscopy_od": risk_data.gonioscopy_od,
            "gonioscopy_os": risk_data.gonioscopy_os,
            "diagnosis_od": risk_data.diagnosis_od,
            "diagnosis_os": risk_data.diagnosis_os,
            "auto_extracted": risk_data.auto_extracted,
            "manually_verified": risk_data.manually_verified
        }
    }


@router.post("/{patient_id}/risk-factors")
def save_glaucoma_risk_factors(patient_id: int, risk_data: Dict[str, Any], db: Session = Depends(get_db)):
    """Manually save/update glaucoma risk factors"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    existing = db.query(GlaucomaRiskData).filter(
        GlaucomaRiskData.patient_id == patient_id
    ).first()
    
    if existing:
        # Update
        for key, value in risk_data.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
        existing.manually_verified = True
        existing.updated_at = datetime.utcnow()
    else:
        # Create
        new_risk_data = GlaucomaRiskData(
            patient_id=patient_id,
            **risk_data,
            manually_verified=True
        )
        db.add(new_risk_data)
    
    db.commit()
    
    return {"message": "Risk factors saved successfully"}


# ============== Generic EMR Section Endpoints (AFTER specific routes) ==============

@router.get("/{patient_id}/{section_type}")
def get_emr_record(patient_id: int, section_type: str, db: Session = Depends(get_db)):
    """Get EMR record for a specific section"""
    record = db.query(EMRRecord).filter(
        EMRRecord.patient_id == patient_id,
        EMRRecord.section_type == section_type
    ).first()
    
    if record:
        return {
            "exists": True,
            "id": record.id,
            "data": record.data,
            "created_at": record.created_at.isoformat() if record.created_at else None,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            "created_by": record.created_by
        }
    
    return {"exists": False}


@router.post("/{patient_id}/{section_type}")
def save_emr_record(patient_id: int, section_type: str, emr_data: EMRDataCreate, db: Session = Depends(get_db)):
    """Save or update EMR record for a section"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Check if record exists
    record = db.query(EMRRecord).filter(
        EMRRecord.patient_id == patient_id,
        EMRRecord.section_type == section_type
    ).first()
    
    if record:
        # Update existing record
        record.data = emr_data.data
        record.updated_at = datetime.utcnow()
    else:
        # Create new record
        record = EMRRecord(
            patient_id=patient_id,
            section_type=section_type,
            data=emr_data.data,
            created_by=emr_data.created_by
        )
        db.add(record)
    
    db.commit()
    db.refresh(record)
    
    # Auto-extract risk factors from EMR data
    extract_risk_factors_from_emr(patient_id, section_type, emr_data.data, db)
    
    return {
        "message": "EMR record saved successfully",
        "id": record.id
    }


@router.delete("/{patient_id}/{section_type}")
def delete_emr_record(patient_id: int, section_type: str, db: Session = Depends(get_db)):
    """Delete EMR record for a section"""
    record = db.query(EMRRecord).filter(
        EMRRecord.patient_id == patient_id,
        EMRRecord.section_type == section_type
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    db.delete(record)
    db.commit()
    
    return {"message": "EMR record deleted successfully"}


# ============== Helper Functions ==============

def get_age_range(age: int) -> str:
    """Convert actual age to age range for TRBS calculator"""
    if age is None:
        return "50_to_70"
    if age < 50:
        return "under_50"
    elif age <= 70:
        return "50_to_70"
    else:
        return "over_70"


def convert_cdr_to_category(cdr_value: str) -> str:
    """Convert CDR value like '0.9' or '0.85' to category"""
    try:
        # Handle values like "0.9", "0.85", "cdr 0.85", etc.
        cdr_str = cdr_value.lower().replace('cdr', '').strip()
        cdr = float(cdr_str)
        
        if cdr <= 0.5:
            return "0.5_or_less"
        elif cdr <= 0.6:
            return "0.6"
        elif cdr <= 0.7:
            return "0.7"
        elif cdr <= 0.8:
            return "0.8"
        else:
            return "0.9_or_more"
    except:
        return "0.5_or_less"


def convert_notch_to_category(notch_value: str) -> str:
    """Convert notch description to category"""
    notch_lower = notch_value.lower() if notch_value else ""
    
    if not notch_value or 'no notch' in notch_lower or notch_value == "":
        return "absent"
    elif 'bipolar' in notch_lower or ('superior' in notch_lower and 'inferior' in notch_lower):
        return "bipolar"
    elif any(x in notch_lower for x in ['unipolar', 'superior', 'inferior', 'temporal', 'nasal']):
        return "unipolar"
    else:
        return "absent"


def convert_pachymetry_to_cct(value: str) -> tuple:
    """Convert pachymetry value to CCT category and actual value"""
    try:
        # Extract number from strings like "520 μm", "518", etc.
        import re
        numbers = re.findall(r'\d+', str(value))
        if numbers:
            pach_value = int(numbers[0])
            cct_category = "normal" if pach_value >= 520 else "thin"
            return cct_category, pach_value
    except:
        pass
    return "normal", None


def extract_systemic_conditions(conditions: list) -> list:
    """Extract systemic risk factors from condition list"""
    systemic_factors = []
    
    condition_mapping = {
        'diabetes': 'diabetes',
        'hypertension': 'hypertension',
        'cardiac': 'cardiovascular_disease',
        'heart': 'cardiovascular_disease',
        'hypotension': 'systemic_hypotension',
        'migraine': 'migraine',
        'headache': 'migraine',
        'raynaud': 'raynaud',
        'sleep apnea': 'sleep_apnea',
        'apnea': 'sleep_apnea'
    }
    
    for cond in conditions:
        cond_lower = cond.get('name', '').lower() if isinstance(cond, dict) else str(cond).lower()
        for key, value in condition_mapping.items():
            if key in cond_lower and value not in systemic_factors:
                systemic_factors.append(value)
    
    return systemic_factors


def extract_ocular_modifiers(diagnosis: str, gonioscopy: str) -> list:
    """Extract ocular modifiers from diagnosis and gonioscopy"""
    modifiers = []
    
    combined_text = f"{diagnosis or ''} {gonioscopy or ''}".lower()
    
    modifier_mapping = {
        'pseudoexfoliation': 'pseudoexfoliation',
        'pxf': 'pseudoexfoliation',
        'pxfg': 'pseudoexfoliation',
        'pigment': 'pigment_dispersion',
        'angle recession': 'angle_recession',
        'recession': 'angle_recession',
        'steroid': 'steroid_responder'
    }
    
    for key, value in modifier_mapping.items():
        if key in combined_text and value not in modifiers:
            modifiers.append(value)
    
    return modifiers


def extract_risk_factors_from_emr(patient_id: int, section_type: str, data, db: Session):
    """
    Extract risk factors from EMR data and update GlaucomaRiskData
    Called automatically when EMR data is saved
    """
    # Handle case where data might be a string (JSON stored as text)
    if isinstance(data, str):
        try:
            import json
            data = json.loads(data)
        except:
            return  # Can't parse, skip extraction
    
    if not isinstance(data, dict):
        return  # Invalid data type
    
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        return
    
    # Get or create risk data record
    risk_data = db.query(GlaucomaRiskData).filter(
        GlaucomaRiskData.patient_id == patient_id
    ).first()
    
    if not risk_data:
        risk_data = GlaucomaRiskData(
            patient_id=patient_id,
            age_range=get_age_range(patient.age)
        )
        db.add(risk_data)
    
    # Update based on section type
    if section_type == 'history':
        # Extract systemic conditions
        conditions = data.get('conditions', [])
        risk_data.systemic_factors = extract_systemic_conditions(conditions)
        
        # Check for family history of glaucoma
        for cond in conditions:
            cond_name = cond.get('name', '') if isinstance(cond, dict) else str(cond)
            if 'family' in cond_name.lower() and 'glaucoma' in cond_name.lower():
                risk_data.family_history = 'present'        
        # NEW: Handle systemicToggles from updated History component
        systemic_toggles = data.get('systemicToggles', {})
        if systemic_toggles:
            # Family history of glaucoma
            if systemic_toggles.get('familyGlaucoma'):
                risk_data.family_history = 'present'
            
            # Build systemic factors list from toggles
            systemic_factors = []
            if systemic_toggles.get('diabetes'):
                systemic_factors.append('diabetes_mellitus')
            if systemic_toggles.get('migraine'):
                systemic_factors.append('migraine_vasospasm')
            if systemic_toggles.get('raynauds'):
                systemic_factors.append('raynauds')
            if systemic_toggles.get('sleepApnea'):
                systemic_factors.append('sleep_apnea')
            if systemic_toggles.get('hypertension') or systemic_toggles.get('cardiac'):
                systemic_factors.append('low_ocular_perfusion')
            
            if systemic_factors:
                risk_data.systemic_factors = systemic_factors
        
        # Handle direct riskFactors if provided
        risk_factors_data = data.get('riskFactors', {})
        if risk_factors_data:
            if risk_factors_data.get('family_history'):
                risk_data.family_history = risk_factors_data['family_history']
            if risk_factors_data.get('systemic_factors'):
                risk_data.systemic_factors = risk_factors_data['systemic_factors']    
    elif section_type == 'fundusexam':
        exam_data = data.get('examData', data)
        
        # CDR extraction
        cdr_data = exam_data.get('discCdr', {})
        if cdr_data.get('re'):
            risk_data.cdr_od = convert_cdr_to_category(cdr_data['re'])
        if cdr_data.get('le'):
            risk_data.cdr_os = convert_cdr_to_category(cdr_data['le'])
        
        # Notching extraction
        notch_data = exam_data.get('discNotch', {})
        if notch_data.get('re'):
            risk_data.notching_od = convert_notch_to_category(notch_data['re'])
        if notch_data.get('le'):
            risk_data.notching_os = convert_notch_to_category(notch_data['le'])
        
        # Disc hemorrhage - check for hemorrhage in background retina or notes
        bg_data = exam_data.get('backgroundRetina', {})
        if bg_data.get('re') and 'hemorrhage' in bg_data['re'].lower():
            risk_data.disc_hemorrhage_od = 'present'
        if bg_data.get('le') and 'hemorrhage' in bg_data['le'].lower():
            risk_data.disc_hemorrhage_os = 'present'
    
    elif section_type == 'investigation':
        investigations = data.get('investigations', {})
        
        # Handle dictionary format from frontend (iop, bp, pachymetry as keys)
        if isinstance(investigations, dict):
            import re as re_module
            
            # IOP extraction from dictionary format
            iop_data = investigations.get('iop', {})
            if iop_data:
                try:
                    re_val = iop_data.get('re', '')
                    le_val = iop_data.get('le', '')
                    
                    re_match = re_module.search(r'(\d+)', str(re_val))
                    le_match = re_module.search(r'(\d+)', str(le_val))
                    
                    if re_match:
                        risk_data.baseline_iop_od = int(re_match.group(1))
                    if le_match:
                        risk_data.baseline_iop_os = int(le_match.group(1))
                except:
                    pass
            
            # Pachymetry extraction from dictionary format
            pach_data = investigations.get('pachymetry', {})
            if pach_data:
                cct_od, pach_od = convert_pachymetry_to_cct(pach_data.get('re', ''))
                cct_os, pach_os = convert_pachymetry_to_cct(pach_data.get('le', ''))
                
                risk_data.cct_od = cct_od
                risk_data.pachymetry_od = pach_od
                risk_data.cct_os = cct_os
                risk_data.pachymetry_os = pach_os
            
            # Gonioscopy extraction from dictionary format
            gonio_data = investigations.get('gonioscopy', {})
            if gonio_data:
                risk_data.gonioscopy_od = gonio_data.get('re', '')
                risk_data.gonioscopy_os = gonio_data.get('le', '')
                
                mods_od = extract_ocular_modifiers('', gonio_data.get('re', ''))
                mods_os = extract_ocular_modifiers('', gonio_data.get('le', ''))
                
                if mods_od:
                    existing = risk_data.ocular_modifiers_od or []
                    risk_data.ocular_modifiers_od = list(set(existing + mods_od))
                if mods_os:
                    existing = risk_data.ocular_modifiers_os or []
                    risk_data.ocular_modifiers_os = list(set(existing + mods_os))
        
        # Handle list format (legacy support)
        elif isinstance(investigations, list):
            import re as re_module
            for inv in investigations:
                inv_name = inv.get('name', '').lower()
                
                # IOP extraction
                if inv_name == 'iop':
                    try:
                        re_val = inv.get('reValue', '')
                        le_val = inv.get('leValue', '')
                        
                        re_match = re_module.search(r'(\d+)', str(re_val))
                        le_match = re_module.search(r'(\d+)', str(le_val))
                        
                        if re_match:
                            risk_data.baseline_iop_od = int(re_match.group(1))
                        if le_match:
                            risk_data.baseline_iop_os = int(le_match.group(1))
                    except:
                        pass
                
                # Pachymetry extraction
                elif inv_name == 'pachymetry':
                    cct_od, pach_od = convert_pachymetry_to_cct(inv.get('reValue', ''))
                    cct_os, pach_os = convert_pachymetry_to_cct(inv.get('leValue', ''))
                    
                    risk_data.cct_od = cct_od
                    risk_data.pachymetry_od = pach_od
                    risk_data.cct_os = cct_os
                    risk_data.pachymetry_os = pach_os
                
                # Gonioscopy extraction
                elif inv_name == 'gonioscopy':
                    risk_data.gonioscopy_od = inv.get('reValue', '')
                    risk_data.gonioscopy_os = inv.get('leValue', '')
                    
                    mods_od = extract_ocular_modifiers('', inv.get('reValue', ''))
                    mods_os = extract_ocular_modifiers('', inv.get('leValue', ''))
                    
                    if mods_od:
                        existing = risk_data.ocular_modifiers_od or []
                        risk_data.ocular_modifiers_od = list(set(existing + mods_od))
                    if mods_os:
                        existing = risk_data.ocular_modifiers_os or []
                        risk_data.ocular_modifiers_os = list(set(existing + mods_os))
    
    elif section_type == 'diagnosis':
        diagnoses = data.get('diagnoses', [])
        
        od_diag = []
        os_diag = []
        
        for diag in diagnoses:
            diag_lower = str(diag).lower()
            
            # Separate by eye
            if 're ' in diag_lower or 'right' in diag_lower or 'od ' in diag_lower:
                od_diag.append(diag)
            elif 'le ' in diag_lower or 'left' in diag_lower or 'os ' in diag_lower:
                os_diag.append(diag)
            else:
                # Apply to both if not specified
                od_diag.append(diag)
                os_diag.append(diag)
        
        risk_data.diagnosis_od = '; '.join(od_diag)
        risk_data.diagnosis_os = '; '.join(os_diag)
        
        # Extract ocular modifiers from diagnosis
        for diag in diagnoses:
            mods = extract_ocular_modifiers(str(diag), '')
            if mods:
                if 'od' in str(diag).lower() or 're ' in str(diag).lower():
                    existing = risk_data.ocular_modifiers_od or []
                    risk_data.ocular_modifiers_od = list(set(existing + mods))
                elif 'os' in str(diag).lower() or 'le ' in str(diag).lower():
                    existing = risk_data.ocular_modifiers_os or []
                    risk_data.ocular_modifiers_os = list(set(existing + mods))
                else:
                    # Apply to both
                    existing_od = risk_data.ocular_modifiers_od or []
                    existing_os = risk_data.ocular_modifiers_os or []
                    risk_data.ocular_modifiers_od = list(set(existing_od + mods))
                    risk_data.ocular_modifiers_os = list(set(existing_os + mods))
    
    risk_data.auto_extracted = True
    risk_data.extracted_at = datetime.utcnow()
    
    db.commit()
