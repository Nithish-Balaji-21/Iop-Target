from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class TargetPressure(Base):
    __tablename__ = "target_pressures"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    
    # System-calculated target values (mmHg)
    calculated_target_od = Column(Float)  # System calculated for right eye
    calculated_target_os = Column(Float)  # System calculated for left eye
    
    # Final target values (may be doctor overridden)
    target_iop_od = Column(Float, nullable=False)  # Right eye final target
    target_iop_os = Column(Float, nullable=False)  # Left eye final target
    
    # Doctor override tracking
    is_overridden_od = Column(String(5), default="NO")  # YES/NO
    is_overridden_os = Column(String(5), default="NO")  # YES/NO
    override_reason = Column(Text)  # Doctor's reason for override
    
    # Per-eye TRBS scores
    trbs_score_od = Column(Integer)  # TRBS score for right eye
    trbs_score_os = Column(Integer)  # TRBS score for left eye
    risk_tier_od = Column(String(20))  # Risk tier for right eye
    risk_tier_os = Column(String(20))  # Risk tier for left eye
    
    # Glaucoma stage at time of calculation (for audit)
    glaucoma_stage_od = Column(String(20))  # EARLY/NORMAL_TENSION/ADVANCED/END_STAGE
    glaucoma_stage_os = Column(String(20))
    
    # Upper caps applied (based on glaucoma stage)
    upper_cap_od = Column(Integer)  # Upper cap for OD (18/16/14/12)
    upper_cap_os = Column(Integer)  # Upper cap for OS
    
    # Baseline IOP used for calculation
    baseline_iop_od = Column(Float)  # Measured IOP used as baseline
    baseline_iop_os = Column(Float)
    
    # Reduction percentages applied
    reduction_percentage_od = Column(Integer)  # % reduction applied to OD
    reduction_percentage_os = Column(Integer)  # % reduction applied to OS
    
    # Tolerance range
    min_iop_od = Column(Float)  # Lower acceptable limit
    max_iop_od = Column(Float)  # Upper acceptable limit
    min_iop_os = Column(Float)
    max_iop_os = Column(Float)
    
    # Rationale
    rationale = Column(Text)  # Why this target was set
    set_by = Column(String(255))  # Clinician who set the target
    
    # Validity
    valid_from = Column(DateTime, default=datetime.utcnow)
    valid_to = Column(DateTime, nullable=True)
    is_current = Column(String(10), default="YES")  # YES/NO
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    patient = relationship("Patient", back_populates="target_pressures")
    
    def __repr__(self):
        return f"<TargetPressure(patient_id={self.patient_id}, od={self.target_iop_od}, os={self.target_iop_os})>"
