from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

# ==================== ENUMS / CONSTANTS ====================

GLAUCOMA_STAGES = ["EARLY", "NORMAL_TENSION", "ADVANCED", "END_STAGE"]

# ==================== HELPER FUNCTIONS ====================

def convert_int_to_yes_no(value: Any) -> Optional[str]:
    """Convert integer (0/1) or boolean to YES/NO string"""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, (int, bool)):
        return "YES" if value else "NO"
    return str(value)

# ==================== PATIENT SCHEMAS ====================

class PatientBase(BaseModel):
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    glaucoma_type: Optional[str] = None
    medical_history: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    # Per-eye glaucoma stage
    glaucoma_stage_od: Optional[str] = "EARLY"  # EARLY/NORMAL_TENSION/ADVANCED/END_STAGE
    glaucoma_stage_os: Optional[str] = "EARLY"

class PatientCreate(PatientBase):
    patient_id: str

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    glaucoma_type: Optional[str] = None
    medical_history: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    glaucoma_stage_od: Optional[str] = None
    glaucoma_stage_os: Optional[str] = None

class PatientResponse(PatientBase):
    id: int
    patient_id: str
    disease_severity: Optional[str] = None
    glaucoma_stage_od: Optional[str] = None
    glaucoma_stage_os: Optional[str] = None
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
    # 3-month validity check
    is_valid: Optional[bool] = True  # False if measurement is >3 months old
    days_since_measurement: Optional[int] = None
    
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
    # System calculated values
    calculated_target_od: Optional[float] = None
    calculated_target_os: Optional[float] = None
    # Doctor override tracking
    is_overridden_od: Optional[str] = "NO"
    is_overridden_os: Optional[str] = "NO"
    override_reason: Optional[str] = None
    # Per-eye TRBS scores
    trbs_score_od: Optional[int] = None
    trbs_score_os: Optional[int] = None
    risk_tier_od: Optional[str] = None
    risk_tier_os: Optional[str] = None
    # Glaucoma stage at calculation time
    glaucoma_stage_od: Optional[str] = None
    glaucoma_stage_os: Optional[str] = None
    # Upper caps applied
    upper_cap_od: Optional[int] = None
    upper_cap_os: Optional[int] = None
    # Baseline IOP used
    baseline_iop_od: Optional[float] = None
    baseline_iop_os: Optional[float] = None
    # Reduction percentages
    reduction_percentage_od: Optional[int] = None
    reduction_percentage_os: Optional[int] = None

class TargetPressureUpdate(BaseModel):
    target_iop_od: Optional[float] = None
    target_iop_os: Optional[float] = None
    min_iop_od: Optional[float] = None
    max_iop_od: Optional[float] = None
    min_iop_os: Optional[float] = None
    max_iop_os: Optional[float] = None
    rationale: Optional[str] = None
    # Doctor override
    is_overridden_od: Optional[str] = None
    is_overridden_os: Optional[str] = None
    override_reason: Optional[str] = None

class TargetPressureResponse(TargetPressureBase):
    id: int
    patient_id: int
    # System calculated values
    calculated_target_od: Optional[float] = None
    calculated_target_os: Optional[float] = None
    # Doctor override tracking
    is_overridden_od: Optional[str] = None
    is_overridden_os: Optional[str] = None
    override_reason: Optional[str] = None
    # Per-eye TRBS scores
    trbs_score_od: Optional[int] = None
    trbs_score_os: Optional[int] = None
    risk_tier_od: Optional[str] = None
    risk_tier_os: Optional[str] = None
    # Glaucoma stage at calculation time
    glaucoma_stage_od: Optional[str] = None
    glaucoma_stage_os: Optional[str] = None
    # Upper caps applied
    upper_cap_od: Optional[int] = None
    upper_cap_os: Optional[int] = None
    # Baseline IOP used
    baseline_iop_od: Optional[float] = None
    baseline_iop_os: Optional[float] = None
    # Reduction percentages
    reduction_percentage_od: Optional[int] = None
    reduction_percentage_os: Optional[int] = None
    # Validity
    valid_from: datetime
    valid_to: Optional[datetime]
    is_current: str
    created_at: datetime
    updated_at: datetime
    
    # Validators to handle integer to string conversion from legacy data
    @field_validator('is_overridden_od', 'is_overridden_os', mode='before')
    @classmethod
    def convert_override_to_string(cls, v):
        return convert_int_to_yes_no(v)
    
    @field_validator('is_current', mode='before')
    @classmethod
    def convert_current_to_string(cls, v):
        return convert_int_to_yes_no(v) or "NO"
    
    class Config:
        from_attributes = True

# ==================== TRBS CALCULATION SCHEMAS ====================

class SingleEyeRiskFactors(BaseModel):
    """Risk factors for a single eye"""
    # Domain B: Structural Changes
    cdr: str = "0.5_or_less"
    notching: str = "absent"
    disc_hemorrhage: str = "absent"
    # Domain C: Functional Changes
    mean_deviation: str = "0_to_minus_6"
    central_field: str = "no"
    # Domain D: Ocular Modifiers
    cct: str = "normal"
    ocular_modifiers: List[str] = []

class TRBSCalculationRequest(BaseModel):
    """Request for TRBS target IOP calculation"""
    # Baseline IOP (from latest measurement)
    baseline_iop_od: float
    baseline_iop_os: float
    # Glaucoma stage per eye
    glaucoma_stage_od: str = "EARLY"  # EARLY/NORMAL_TENSION/ADVANCED/END_STAGE
    glaucoma_stage_os: str = "EARLY"
    # Domain A: Demographic (shared)
    age: str = "50_to_70"
    family_history: str = "absent"
    # Per-eye risk factors
    risk_factors_od: Optional[SingleEyeRiskFactors] = None
    risk_factors_os: Optional[SingleEyeRiskFactors] = None
    # Domain E: Systemic (shared)
    systemic_factors: List[str] = []
    # Domain F: Patient factors (shared)
    patient_factors: List[str] = []
    # Options
    use_aggressive_reduction: bool = False

class SingleEyeCalculationResult(BaseModel):
    """Result for a single eye"""
    eye: str
    trbs_score: int
    risk_tier: str
    reduction_percentage_min: int
    reduction_percentage_max: int
    reduction_applied: int
    glaucoma_stage: str
    upper_cap: int
    baseline_iop: float
    calculated_target: float
    final_target: float
    domain_scores: Dict[str, int]

class TRBSCalculationResponse(BaseModel):
    """Response from TRBS calculation"""
    od_result: SingleEyeCalculationResult
    os_result: SingleEyeCalculationResult
    # Legacy fields
    target_iop_od: float
    target_iop_os: float

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
    current_iop_status: str  # WITHIN_TARGET, ABOVE_TARGET, BELOW_TARGET
    reasons: list
    recommended_followup_days: int
    recommended_actions: list

class PatientDashboardResponse(BaseModel):
    patient: PatientResponse
    current_target: Optional[TargetPressureResponse]
    latest_measurement: Optional[IOPMeasurementResponse]
    latest_visit: Optional[VisitResponse]
    risk_assessment: Optional[RiskAssessmentResponse]
