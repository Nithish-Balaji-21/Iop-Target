from sqlalchemy import Column, Integer, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Visit(Base):
    __tablename__ = "visits"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    
    # Visit details
    visit_date = Column(DateTime, nullable=False, index=True)
    visit_type = Column(String(50))  # ROUTINE, URGENT, EMERGENCY
    
    # Clinical assessment
    risk_level = Column(String(50))  # LOW, MODERATE, HIGH
    risk_score = Column(Integer)  # 0-100
    recommended_followup_days = Column(Integer)  # Days until next visit
    
    # Clinical notes
    findings = Column(Text)
    treatment_changes = Column(Text)
    doctor_notes = Column(Text)
    
    # Metadata
    created_by = Column(String(255))  # Clinician
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    patient = relationship("Patient", back_populates="visits")
    
    def __repr__(self):
        return f"<Visit(patient_id={self.patient_id}, risk_level={self.risk_level})>"
