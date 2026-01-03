from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    age = Column(Integer)
    gender = Column(String(10))  # M, F, O
    
    # Baseline (First Untreated) IOP values
    baseline_iop_od = Column(Float, nullable=True)  # First untreated IOP - Right Eye
    baseline_iop_os = Column(Float, nullable=True)  # First untreated IOP - Left Eye
    
    # Glaucoma-specific fields
    glaucoma_type = Column(String(50))  # POAG, ANGLE_CLOSURE, etc
    disease_severity = Column(String(20), default="MODERATE")  # MILD, MODERATE, SEVERE
    
    # Eye-specific glaucoma stage (per eye)
    # EARLY = EMGT/OHTS (cap ≤18), NORMAL_TENSION = CNGTS (cap ≤16), 
    # ADVANCED = AGIS (cap ≤14), END_STAGE (cap ≤12)
    glaucoma_stage_od = Column(String(20), default="EARLY")  # Right eye stage
    glaucoma_stage_os = Column(String(20), default="EARLY")  # Left eye stage
    
    # Eye-specific data
    od_status = Column(String(50), default="BOTH")  # OD, OS, BOTH
    os_status = Column(String(50), default="BOTH")
    
    # Medical history
    medical_history = Column(Text)
    current_medications = Column(Text)
    allergies = Column(Text)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    iop_measurements = relationship("IOPMeasurement", back_populates="patient", cascade="all, delete-orphan")
    target_pressures = relationship("TargetPressure", back_populates="patient", cascade="all, delete-orphan")
    visits = relationship("Visit", back_populates="patient", cascade="all, delete-orphan")
    emr_records = relationship("EMRRecord", back_populates="patient", cascade="all, delete-orphan")
    glaucoma_risk_data = relationship("GlaucomaRiskData", back_populates="patient", cascade="all, delete-orphan", uselist=False)
    
    def __repr__(self):
        return f"<Patient(id={self.id}, patient_id={self.patient_id}, name={self.name})>"
