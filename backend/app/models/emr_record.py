"""
EMR Records Model
Stores EMR data for different sections (history, fundus exam, investigation, etc.)
"""

from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class EMRRecord(Base):
    """
    Stores EMR data for different sections
    """
    __tablename__ = 'emr_records'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    section_type = Column(String(50), nullable=False)  # history, fundusexam, investigation, diagnosis, etc.
    data = Column(JSON, nullable=False)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint on patient_id + section_type
    __table_args__ = (
        {'extend_existing': True}
    )
    
    # Relationship
    patient = relationship("Patient", back_populates="emr_records")


class GlaucomaRiskData(Base):
    """
    Stores extracted glaucoma risk factors from EMR data
    Used for auto-populating Target IOP calculator
    """
    __tablename__ = 'glaucoma_risk_data'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False, unique=True)
    
    # Domain A: Demographics (Shared)
    age_range = Column(String(20))  # under_50, 50_to_70, over_70
    family_history = Column(String(20), default='absent')  # absent, present
    
    # Domain B: Baseline IOP
    baseline_iop_od = Column(Integer)
    baseline_iop_os = Column(Integer)
    num_agm = Column(String(20), default='0')  # 0, 1, 2, 3_or_more
    
    # Domain C: Structural - Right Eye (OD)
    cdr_od = Column(String(20))  # 0.5_or_less, 0.6, 0.7, 0.8, 0.9_or_more
    notching_od = Column(String(20))  # absent, unipolar, bipolar
    disc_hemorrhage_od = Column(String(20))  # absent, present
    
    # Domain C: Structural - Left Eye (OS)
    cdr_os = Column(String(20))
    notching_os = Column(String(20))
    disc_hemorrhage_os = Column(String(20))
    
    # Domain D: Functional - Right Eye (OD)
    mean_deviation_od = Column(String(30))  # 0_to_minus_6, minus_6_to_minus_12, less_than_minus_12
    central_field_od = Column(String(10))  # yes, no
    
    # Domain D: Functional - Left Eye (OS)
    mean_deviation_os = Column(String(30))
    central_field_os = Column(String(10))
    
    # Domain E: Ocular - Right Eye (OD)
    cct_od = Column(String(20))  # normal, thin
    pachymetry_od = Column(Integer)  # Actual value in µm
    ocular_modifiers_od = Column(JSON, default=list)  # angle_recession, pseudoexfoliation, etc.
    
    # Domain E: Ocular - Left Eye (OS)
    cct_os = Column(String(20))
    pachymetry_os = Column(Integer)
    ocular_modifiers_os = Column(JSON, default=list)
    
    # Domain F: Systemic (Shared)
    systemic_factors = Column(JSON, default=list)  # diabetes, hypertension, etc.
    
    # Domain G: Patient Factors (Shared)
    patient_factors = Column(JSON, default=list)  # monocular, rapid_progression, etc.
    
    # Additional data for reference
    gonioscopy_od = Column(String(100))
    gonioscopy_os = Column(String(100))
    diagnosis_od = Column(String(200))
    diagnosis_os = Column(String(200))
    
    # Metadata
    auto_extracted = Column(Boolean, default=True)
    manually_verified = Column(Boolean, default=False)
    extracted_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    patient = relationship("Patient", back_populates="glaucoma_risk_data")
