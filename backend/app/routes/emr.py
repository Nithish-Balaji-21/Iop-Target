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

@router.get("/{patient_id}/current-iop")
def get_current_iop_from_investigation(patient_id: int, db: Session = Depends(get_db)):
    """
    Get current IOP from investigation section (current visit IOP).
    This is used for displaying current measurement in Target IOP calculator.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Get latest investigation record
    investigation_record = db.query(EMRRecord).filter(
        EMRRecord.patient_id == patient_id,
        EMRRecord.section_type == 'investigation'
    ).order_by(EMRRecord.created_at.desc()).first()
    
    if investigation_record and investigation_record.data:
        investigations = investigation_record.data.get('investigations', {})
        if isinstance(investigations, dict):
            iop_data = investigations.get('iop', {})
            if iop_data:
                import re
                re_val = iop_data.get('re', '')
                le_val = iop_data.get('le', '')
                
                re_match = re.search(r'(\d+)', str(re_val))
                le_match = re.search(r'(\d+)', str(le_val))
                
                current_iop_od = int(re_match.group(1)) if re_match else None
                current_iop_os = int(le_match.group(1)) if le_match else None
                
                if current_iop_od is not None or current_iop_os is not None:
                    return {
                        "exists": True,
                        "iop_od": current_iop_od,
                        "iop_os": current_iop_os,
                        "source": "investigation",
                        "date": investigation_record.created_at.isoformat() if investigation_record.created_at else None
                    }
    
    # Fallback to latest measurement
    from app.models import IOPMeasurement
    latest_measurement = db.query(IOPMeasurement).filter(
        IOPMeasurement.patient_id == patient_id
    ).order_by(IOPMeasurement.measurement_date.desc()).first()
    
    if latest_measurement:
        return {
            "exists": True,
            "iop_od": latest_measurement.iop_od,
            "iop_os": latest_measurement.iop_os,
            "source": "measurement",
            "date": latest_measurement.measurement_date.isoformat() if latest_measurement.measurement_date else None
        }
    
    return {
        "exists": False,
        "message": "No current IOP found in investigation or measurements"
    }


@router.get("/{patient_id}/risk-factors")
def get_glaucoma_risk_factors(patient_id: int, db: Session = Depends(get_db)):
    """Get extracted glaucoma risk factors for Target IOP calculation"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    risk_data = db.query(GlaucomaRiskData).filter(
        GlaucomaRiskData.patient_id == patient_id
    ).first()
    
    # Calculate BP-derived DOPP if investigation data exists
    # Also update systemic_factors if low perfusion is detected
    dopp_info = None
    try:
        from app.models import IOPMeasurement, EMRRecord
        import re
        
        # Get latest investigation record
        investigation_record = db.query(EMRRecord).filter(
            EMRRecord.patient_id == patient_id,
            EMRRecord.section_type == 'investigation'
        ).order_by(EMRRecord.created_at.desc()).first()
        
        if investigation_record and investigation_record.data:
            inv_data = investigation_record.data.get('investigations', {})
            bp_data = inv_data.get('bp', {})
            bp_value = bp_data.get('value', '')
            
            if bp_value:
                bp_match = re.search(r'(\d+)\s*[/]\s*(\d+)', str(bp_value))
                if bp_match:
                    diastolic = int(bp_match.group(2))
                    
                    # Priority: Use IOP from investigation (current visit) first, then latest measurement
                    current_iop_od = None
                    current_iop_os = None
                    
                    # First try: Get IOP from investigation data (current visit IOP)
                    iop_data = inv_data.get('iop', {})
                    if iop_data:
                        try:
                            re_val = iop_data.get('re', '')
                            le_val = iop_data.get('le', '')
                            re_match = re.search(r'(\d+)', str(re_val))
                            le_match = re.search(r'(\d+)', str(le_val))
                            if re_match:
                                current_iop_od = int(re_match.group(1))
                            if le_match:
                                current_iop_os = int(le_match.group(1))
                        except:
                            pass
                    
                    # Fallback: Use latest measurement if investigation IOP not available
                    if current_iop_od is None or current_iop_os is None:
                        latest_measurement = db.query(IOPMeasurement).filter(
                            IOPMeasurement.patient_id == patient_id
                        ).order_by(IOPMeasurement.measurement_date.desc()).first()
                        
                        if latest_measurement:
                            if current_iop_od is None:
                                current_iop_od = latest_measurement.iop_od
                            if current_iop_os is None:
                                current_iop_os = latest_measurement.iop_os
                    
                    # Calculate DOPP for both eyes
                    if current_iop_od is not None or current_iop_os is not None:
                        dopp_od = diastolic - current_iop_od if current_iop_od is not None else None
                        dopp_os = diastolic - current_iop_os if current_iop_os is not None else None
                        
                        low_perfusion_od = dopp_od is not None and dopp_od < 50
                        low_perfusion_os = dopp_os is not None and dopp_os < 50
                        
                        dopp_info = {
                            "bp_value": bp_value,
                            "diastolic": diastolic,
                            "dopp_od": dopp_od,
                            "dopp_os": dopp_os,
                            "low_perfusion_od": low_perfusion_od,
                            "low_perfusion_os": low_perfusion_os,
                            "iop_od": current_iop_od,
                            "iop_os": current_iop_os
                        }
                        
                        # Update systemic_factors if low perfusion detected and risk_data exists
                        if risk_data and (low_perfusion_od or low_perfusion_os):
                            existing_systemic = risk_data.systemic_factors or []
                            if 'low_ocular_perfusion' not in existing_systemic:
                                existing_systemic = list(existing_systemic)  # Make a copy
                                existing_systemic.append('low_ocular_perfusion')
                                risk_data.systemic_factors = existing_systemic
                                db.commit()
                                db.refresh(risk_data)  # Refresh to get updated data
                                print(f"✓ Updated systemic_factors: Low Ocular Perfusion Pressure detected (DOPP OD={dopp_od}, OS={dopp_os})")
                        elif risk_data and not (low_perfusion_od or low_perfusion_os):
                            # Remove if no longer low
                            existing_systemic = risk_data.systemic_factors or []
                            if 'low_ocular_perfusion' in existing_systemic:
                                existing_systemic = list(existing_systemic)  # Make a copy
                                existing_systemic.remove('low_ocular_perfusion')
                                risk_data.systemic_factors = existing_systemic
                                db.commit()
                                db.refresh(risk_data)  # Refresh to get updated data
                                print(f"✓ Updated systemic_factors: DOPP is now normal (OD={dopp_od}, OS={dopp_os}), removed low_ocular_perfusion")
    except Exception as e:
        print(f"Error calculating DOPP: {e}")
        import traceback
        traceback.print_exc()
    
    if not risk_data:
        # Return default values with patient age
        age_range = get_age_range(patient.age) if patient.age else "50_to_70"
        
        # If DOPP is low, include low_ocular_perfusion in default systemic_factors
        default_systemic_factors = []
        if dopp_info and (dopp_info.get('low_perfusion_od') or dopp_info.get('low_perfusion_os')):
            default_systemic_factors = ['low_ocular_perfusion']
        
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
                "mean_deviation_od": "hfa_not_done",  # Default to HFA not done if no data
                "central_field_od": "no",
                "mean_deviation_os": "hfa_not_done",  # Default to HFA not done if no data
                "central_field_os": "no",
                "cct_od": "normal",
                "cct_os": "normal",
                "ocular_modifiers_od": [],
                "ocular_modifiers_os": [],
                "systemic_factors": default_systemic_factors,  # Include low_ocular_perfusion if DOPP is low
                "patient_factors": [],
                "auto_extracted": False,
                "manually_verified": False,
                "dopp_info": dopp_info
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
            "rnfl_defect_od": risk_data.rnfl_defect_od or "absent",
            "disc_hemorrhage_od": risk_data.disc_hemorrhage_od,
            "cdr_os": risk_data.cdr_os,
            "notching_os": risk_data.notching_os,
            "rnfl_defect_os": risk_data.rnfl_defect_os or "absent",
            "disc_hemorrhage_os": risk_data.disc_hemorrhage_os,
            "mean_deviation_od": risk_data.mean_deviation_od or "hfa_not_done",  # Default to HFA not done if not set
            "central_field_od": risk_data.central_field_od or "no",
            "mean_deviation_os": risk_data.mean_deviation_os or "hfa_not_done",  # Default to HFA not done if not set
            "central_field_os": risk_data.central_field_os or "no",
            "cct_od": risk_data.cct_od,
            "pachymetry_od": risk_data.pachymetry_od,
            "cct_os": risk_data.cct_os,
            "pachymetry_os": risk_data.pachymetry_os,
            "myopia_od": risk_data.myopia_od,
            "myopia_os": risk_data.myopia_os,
            "ocular_modifiers_od": risk_data.ocular_modifiers_od or [],
            "ocular_modifiers_os": risk_data.ocular_modifiers_os or [],
            "systemic_factors": risk_data.systemic_factors or [],
            "patient_factors": risk_data.patient_factors or [],
            "gonioscopy_od": risk_data.gonioscopy_od,
            "gonioscopy_os": risk_data.gonioscopy_os,
            "diagnosis_od": risk_data.diagnosis_od,
            "diagnosis_os": risk_data.diagnosis_os,
            "auto_extracted": risk_data.auto_extracted,
            "manually_verified": risk_data.manually_verified,
            "dopp_info": dopp_info  # Include BP calculation info
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
    
    # If investigation section with IOP data, create IOPMeasurement record for graph
    if section_type == 'investigation':
        investigations = emr_data.data.get('investigations', {})
        if isinstance(investigations, dict):
            iop_data = investigations.get('iop', {})
            if iop_data:
                import re
                re_val = iop_data.get('re', '')
                le_val = iop_data.get('le', '')
                date_time_str = iop_data.get('dateTime', '')
                
                # Extract IOP values
                re_match = re.search(r'(\d+)', str(re_val))
                le_match = re.search(r'(\d+)', str(le_val))
                
                iop_od = None
                iop_os = None
                
                if re_match:
                    iop_od = float(re_match.group(1))
                if le_match:
                    iop_os = float(le_match.group(1))
                
                # Only create measurement if at least one IOP value exists
                if iop_od is not None or iop_os is not None:
                    from app.models import IOPMeasurement
                    
                    # Parse date/time if provided, otherwise use current time
                    measurement_date = datetime.utcnow()
                    if date_time_str:
                        try:
                            # Try to parse various date formats using dateutil
                            from dateutil import parser
                            measurement_date = parser.parse(date_time_str)
                        except:
                            pass  # Use current time if parsing fails
                    
                    # Check if measurement already exists for this date (within 1 hour)
                    existing = db.query(IOPMeasurement).filter(
                        IOPMeasurement.patient_id == patient_id,
                        IOPMeasurement.measurement_date >= measurement_date.replace(hour=0, minute=0, second=0),
                        IOPMeasurement.measurement_date < measurement_date.replace(hour=23, minute=59, second=59)
                    ).first()
                    
                    if not existing:
                        # Create new IOPMeasurement record
                        new_measurement = IOPMeasurement(
                            patient_id=patient_id,
                            iop_od=iop_od,
                            iop_os=iop_os,
                            measurement_date=measurement_date,
                            measured_by=emr_data.created_by or 'EMR Investigation',
                            device_type='Goldmann Tonometry',  # Default, can be updated
                            clinical_notes=f'IOP recorded from Investigation section'
                        )
                        db.add(new_measurement)
                        db.commit()
                        print(f"✓ Created IOPMeasurement record: OD={iop_od}, OS={iop_os} for patient {patient_id}")
    
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
    """Convert pachymetry value to CCT category and actual value
    According to Excel: <500 µm = thin (+1 pt), ≥500 µm = normal (0 pts)
    """
    try:
        # Extract number from strings like "520 μm", "518", "495", etc.
        import re
        numbers = re.findall(r'\d+', str(value))
        if numbers:
            pach_value = int(numbers[0])
            # <500 µm = thin, ≥500 µm = normal (matching Excel data)
            cct_category = "normal" if pach_value >= 500 else "thin"
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
        
        # RNFL defect extraction
        rnfl_data = exam_data.get('rnflDefect', {})
        if rnfl_data.get('re'):
            risk_data.rnfl_defect_od = 'present' if rnfl_data['re'].lower() == 'present' else 'absent'
        if rnfl_data.get('le'):
            risk_data.rnfl_defect_os = 'present' if rnfl_data['le'].lower() == 'present' else 'absent'
    
    elif section_type == 'investigation':
        investigations = data.get('investigations', {})
        
        # Handle dictionary format from frontend (iop, bp, pachymetry as keys)
        if isinstance(investigations, dict):
            import re as re_module
            
            # IOP extraction from dictionary format
            # NOTE: Investigation IOP is CURRENT IOP, not baseline IOP
            # Baseline IOP should come from Complaints section (first untreated IOP)
            # Investigation IOP is used for BP/DOPP calculation and current status
            iop_data = investigations.get('iop', {})
            if iop_data:
                try:
                    re_val = iop_data.get('re', '')
                    le_val = iop_data.get('le', '')
                    
                    re_match = re_module.search(r'(\d+)', str(re_val))
                    le_match = re_module.search(r'(\d+)', str(le_val))
                    
                    # Only set baseline IOP from investigation if no baseline exists
                    # (This handles cases where investigation was done before Complaints section)
                    if re_match and risk_data.baseline_iop_od is None:
                        risk_data.baseline_iop_od = int(re_match.group(1))
                    if le_match and risk_data.baseline_iop_os is None:
                        risk_data.baseline_iop_os = int(le_match.group(1))
                except:
                    pass
            
            # BP extraction and DOPP calculation (Diastolic Ocular Perfusion Pressure)
            # DOPP = Diastolic BP - Current IOP
            # If DOPP < 50, add "low_ocular_perfusion" to systemic factors
            bp_data = investigations.get('bp', {})
            if bp_data:
                bp_value = bp_data.get('value', '')
                if bp_value:
                    try:
                        # Extract systolic and diastolic from formats like "140/80", "140 / 80", "140/80 mm Hg"
                        bp_match = re_module.search(r'(\d+)\s*[/]\s*(\d+)', str(bp_value))
                        if bp_match:
                            systolic = int(bp_match.group(1))
                            diastolic = int(bp_match.group(2))
                            
                            # Priority: Use IOP from investigation if available, otherwise use latest measurement
                            current_iop_od = None
                            current_iop_os = None
                            
                            # First try: Get IOP from investigation data (current visit IOP)
                            if iop_data:
                                try:
                                    re_val = iop_data.get('re', '')
                                    le_val = iop_data.get('le', '')
                                    re_match = re_module.search(r'(\d+)', str(re_val))
                                    le_match = re_module.search(r'(\d+)', str(le_val))
                                    if re_match:
                                        current_iop_od = int(re_match.group(1))
                                    if le_match:
                                        current_iop_os = int(le_match.group(1))
                                except:
                                    pass
                            
                            # Fallback: Use latest measurement if investigation IOP not available
                            if current_iop_od is None or current_iop_os is None:
                                from app.models import IOPMeasurement
                                latest_measurement = db.query(IOPMeasurement).filter(
                                    IOPMeasurement.patient_id == patient_id
                                ).order_by(IOPMeasurement.measurement_date.desc()).first()
                                
                                if latest_measurement:
                                    if current_iop_od is None:
                                        current_iop_od = latest_measurement.iop_od
                                    if current_iop_os is None:
                                        current_iop_os = latest_measurement.iop_os
                            
                            # Calculate DOPP for both eyes
                            # DOPP = Diastolic BP - Current IOP
                            # If DOPP < 50, add "low_ocular_perfusion" to systemic factors
                            existing_systemic = risk_data.systemic_factors or []
                            low_perfusion_detected = False
                            
                            if current_iop_od is not None:
                                dopp_od = diastolic - current_iop_od
                                if dopp_od < 50:
                                    if 'low_ocular_perfusion' not in existing_systemic:
                                        existing_systemic.append('low_ocular_perfusion')
                                        low_perfusion_detected = True
                            
                            if current_iop_os is not None:
                                dopp_os = diastolic - current_iop_os
                                if dopp_os < 50:
                                    if 'low_ocular_perfusion' not in existing_systemic:
                                        existing_systemic.append('low_ocular_perfusion')
                                        low_perfusion_detected = True
                            
                            if low_perfusion_detected:
                                risk_data.systemic_factors = existing_systemic
                                print(f"✓ Low Ocular Perfusion Pressure detected: DOPP OD={dopp_od if current_iop_od else 'N/A'}, OS={dopp_os if current_iop_os else 'N/A'} (BP: {bp_value}, Diastolic: {diastolic}mmHg)")
                    except Exception as e:
                        print(f"Error processing BP data: {e}")
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
    
    elif section_type == 'refraction':
        # Extract myopia from SPH (Spherical) values
        prescription = data.get('prescription', {})
        
        # Helper function to convert SPH to myopia category
        def sph_to_myopia(sph_str):
            """Convert SPH value to myopia category
            - 0 to -0.9: none (no myopia)
            - -1 to -3: low_myopia
            - -3.1 and greater: mod_high_myopia
            """
            if not sph_str or sph_str == '':
                return None
            
            try:
                # Parse SPH value (handle negative signs, decimals, remove units)
                sph_clean = str(sph_str).strip().replace('+', '').replace('DS', '').replace('D', '').replace('Sph', '').replace('SPH', '').strip()
                sph_value = float(sph_clean)
                
                # Map to myopia category
                if sph_value >= 0 or sph_value > -1:
                    return 'none'  # 0 to -0.9 (no myopia)
                elif sph_value >= -3:
                    return 'low_myopia'  # -1 to -3 (low myopia)
                else:
                    return 'mod_high_myopia'  # -3.1 and greater (moderate to high myopia)
            except (ValueError, AttributeError):
                return None
        
        # Extract from distance prescription (primary)
        distance = prescription.get('distance', {})
        myopia_od = None
        myopia_os = None
        
        if distance:
            od_sph = distance.get('od', {}).get('sph', '')
            os_sph = distance.get('os', {}).get('sph', '')
            
            myopia_od = sph_to_myopia(od_sph)
            myopia_os = sph_to_myopia(os_sph)
            
            if myopia_od:
                risk_data.myopia_od = myopia_od
            if myopia_os:
                risk_data.myopia_os = myopia_os
        
        # If distance not available, try near prescription
        if not myopia_od or not myopia_os:
            near = prescription.get('near', {})
            if near:
                if not myopia_od:
                    od_sph_near = near.get('od', {}).get('sph', '')
                    myopia_od_near = sph_to_myopia(od_sph_near)
                    if myopia_od_near:
                        risk_data.myopia_od = myopia_od_near
                
                if not myopia_os:
                    os_sph_near = near.get('os', {}).get('sph', '')
                    myopia_os_near = sph_to_myopia(os_sph_near)
                    if myopia_os_near:
                        risk_data.myopia_os = myopia_os_near
    
    risk_data.auto_extracted = True
    risk_data.extracted_at = datetime.utcnow()
    
    # Debug logging
    if section_type == 'fundusexam':
        print(f"✓ Fundus Exam extraction: RNFL OD={risk_data.rnfl_defect_od}, OS={risk_data.rnfl_defect_os}")
    elif section_type == 'investigation':
        print(f"✓ Investigation extraction: CCT OD={risk_data.cct_od} (pach={risk_data.pachymetry_od}), OS={risk_data.cct_os} (pach={risk_data.pachymetry_os})")
    elif section_type == 'refraction':
        print(f"✓ Refraction extraction: Myopia OD={risk_data.myopia_od}, OS={risk_data.myopia_os}")
    
    db.commit()
    db.refresh(risk_data)  # Refresh to ensure data is saved
