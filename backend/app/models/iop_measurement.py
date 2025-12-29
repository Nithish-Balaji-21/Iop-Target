from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class IOPMeasurement(Base):
    __tablename__ = "iop_measurements"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    
    # IOP Values (mmHg)
    iop_od = Column(Float, nullable=True)  # Right eye
    iop_os = Column(Float, nullable=True)  # Left eye
    
    # Measurement details
    measurement_date = Column(DateTime, nullable=False, index=True)
    measured_by = Column(String(255))  # Clinician name
    device_type = Column(String(100))  # Tonometry type (e.g., Goldmann, Pneumotonometry)
    
    # Additional metrics
    oct_rnfl_od = Column(Float, nullable=True)  # OCT RNFL thickness OD (microns)
    oct_rnfl_os = Column(Float, nullable=True)  # OCT RNFL thickness OS
    vf_md_od = Column(Float, nullable=True)  # Visual Field Mean Deviation OD (dB)
    vf_md_os = Column(Float, nullable=True)  # Visual Field Mean Deviation OS
    
    # Risk indicators
    pressure_status_od = Column(String(50), default="UNKNOWN")  # CONTROLLED, ABOVE_TARGET, CRITICAL
    pressure_status_os = Column(String(50), default="UNKNOWN")
    
    # Notes
    clinical_notes = Column(Text)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    patient = relationship("Patient", back_populates="iop_measurements")
    
    def __repr__(self):
        return f"<IOPMeasurement(patient_id={self.patient_id}, iop_od={self.iop_od}, iop_os={self.iop_os})>"
