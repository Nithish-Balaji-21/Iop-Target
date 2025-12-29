from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
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
    
    # Glaucoma-specific fields
    glaucoma_type = Column(String(50))  # POAG, ANGLE_CLOSURE, etc
    disease_severity = Column(String(50))  # MILD, MODERATE, SEVERE
    
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
    
    def __repr__(self):
        return f"<Patient(id={self.id}, patient_id={self.patient_id}, name={self.name})>"
