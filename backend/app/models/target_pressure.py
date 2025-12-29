from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class TargetPressure(Base):
    __tablename__ = "target_pressures"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    
    # Target values for each eye (mmHg)
    target_iop_od = Column(Float, nullable=False)  # Right eye target
    target_iop_os = Column(Float, nullable=False)  # Left eye target
    
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
