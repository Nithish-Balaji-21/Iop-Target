from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# ==================== PATIENT SCHEMAS ====================

class PatientBase(BaseModel):
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    glaucoma_type: Optional[str] = None
    disease_severity: Optional[str] = None
    medical_history: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None

class PatientCreate(PatientBase):
    patient_id: str

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    glaucoma_type: Optional[str] = None
    disease_severity: Optional[str] = None
    medical_history: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None

class PatientResponse(PatientBase):
    id: int
    patient_id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

# ==================== IOP MEASUREMENT SCHEMAS ====================

class IOPMeasurementBase(BaseModel):
    iop_od: Optional[float] = None
    iop_os: Optional[float] = None
    measurement_date: datetime
    measured_by: Optional[str] = None
    device_type: Optional[str] = None
    oct_rnfl_od: Optional[float] = None
    oct_rnfl_os: Optional[float] = None
    vf_md_od: Optional[float] = None
    vf_md_os: Optional[float] = None
    clinical_notes: Optional[str] = None

class IOPMeasurementCreate(IOPMeasurementBase):
    patient_id: int

class IOPMeasurementResponse(IOPMeasurementBase):
    id: int
    patient_id: int
    pressure_status_od: str
    pressure_status_os: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ==================== TARGET PRESSURE SCHEMAS ====================

class TargetPressureBase(BaseModel):
    target_iop_od: float = Field(..., gt=0, le=50)
    target_iop_os: float = Field(..., gt=0, le=50)
    min_iop_od: Optional[float] = None
    max_iop_od: Optional[float] = None
    min_iop_os: Optional[float] = None
    max_iop_os: Optional[float] = None
    rationale: Optional[str] = None
    set_by: Optional[str] = None

class TargetPressureCreate(TargetPressureBase):
    patient_id: int

class TargetPressureUpdate(BaseModel):
    target_iop_od: Optional[float] = None
    target_iop_os: Optional[float] = None
    min_iop_od: Optional[float] = None
    max_iop_od: Optional[float] = None
    min_iop_os: Optional[float] = None
    max_iop_os: Optional[float] = None
    rationale: Optional[str] = None

class TargetPressureResponse(TargetPressureBase):
    id: int
    patient_id: int
    valid_from: datetime
    valid_to: Optional[datetime]
    is_current: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ==================== VISIT SCHEMAS ====================

class VisitBase(BaseModel):
    visit_date: datetime
    visit_type: str
    findings: Optional[str] = None
    treatment_changes: Optional[str] = None
    doctor_notes: Optional[str] = None

class VisitCreate(VisitBase):
    patient_id: int
    created_by: str

class VisitResponse(VisitBase):
    id: int
    patient_id: int
    risk_level: str
    risk_score: int
    recommended_followup_days: int
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ==================== RISK ASSESSMENT SCHEMAS ====================

class RiskAssessmentResponse(BaseModel):
    patient_id: int
    risk_level: str  # LOW, MODERATE, HIGH
    risk_score: int  # 0-100
    reasons: list
    recommended_followup_days: int
    recommended_actions: list

class PatientDashboardResponse(BaseModel):
    patient: PatientResponse
    current_target: Optional[TargetPressureResponse]
    latest_measurement: Optional[IOPMeasurementResponse]
    latest_visit: Optional[VisitResponse]
    risk_assessment: Optional[RiskAssessmentResponse]
