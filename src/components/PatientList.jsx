import React, { useState } from 'react';
import { usePatients } from '../hooks';
import { LoadingSpinner, EmptyState } from './Common';
import { patientService } from '../services/api';
import '../styles/PatientList.css';

// Helper function to get glaucoma type full form
const getGlaucomaTypeFullForm = (type) => {
  const types = {
    'POAG': 'POAG',
    'PXFG': 'PXFG',
    'PG': 'Pigmentary',
    'JG': 'Juvenile',
    'PACG_PI': 'PACG s/p PI',
    'NTG': 'NTG',
    'OHT': 'OHT',
    'PACG': 'PACG',
    'SECONDARY': 'Secondary',
    'CONGENITAL': 'Congenital'
  };
  return types[type] || type || 'N/A';
};

function PatientList({ onSelectPatient }) {
  const { patients, loading, error, refetch } = usePatients();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPatient, setNewPatient] = useState({
    patient_id: '',
    name: '',
    age: '',
    gender: '',
    glaucoma_type: ''
  });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPatient(prev => ({
      ...prev,
      [name]: name === 'age' ? (value === '' ? '' : parseInt(value) || '') : value
    }));
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);

    try {
      // Validate required fields
      if (!newPatient.patient_id || !newPatient.name) {
        setAddError('Patient ID and Name are required');
        setAddLoading(false);
        return;
      }

      await patientService.createPatient({
        ...newPatient,
        age: newPatient.age || null
      });

      // Reset form and refresh list
      setNewPatient({
        patient_id: '',
        name: '',
        age: '',
        gender: '',
        glaucoma_type: ''
      });
      setShowAddForm(false);
      refetch();
    } catch (err) {
      setAddError(err.message || 'Failed to add patient');
    } finally {
      setAddLoading(false);
    }
  };

  const filteredPatients = patients.filter((patient) =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patient_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="patient-list">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="patient-list">
      <div className="list-header">
        <h2>👥 Patients</h2>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button 
            className="btn-add-patient"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? '✕ Cancel' : '➕ Add Patient'}
          </button>
        </div>
      </div>

      {/* Add Patient Form */}
      {showAddForm && (
        <div className="add-patient-form">
          <h3>Add New Patient</h3>
          {addError && <div className="error-message">{addError}</div>}
          <form onSubmit={handleAddPatient}>
            <div className="form-row">
              <div className="form-group">
                <label>Patient ID *</label>
                <input
                  type="text"
                  name="patient_id"
                  value={newPatient.patient_id}
                  onChange={handleInputChange}
                  placeholder="e.g., GL-001"
                  required
                />
              </div>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={newPatient.name}
                  onChange={handleInputChange}
                  placeholder="Patient name"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  name="age"
                  value={newPatient.age}
                  onChange={handleInputChange}
                  placeholder="Age"
                  min="0"
                  max="150"
                />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select
                  name="gender"
                  value={newPatient.gender}
                  onChange={handleInputChange}
                >
                  <option value="">Select Gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Glaucoma Type</label>
                <select
                  name="glaucoma_type"
                  value={newPatient.glaucoma_type}
                  onChange={handleInputChange}
                >
                  <option value="">Select Type</option>
                  <option value="POAG">POAG (Primary Open-Angle Glaucoma)</option>
                  <option value="PXFG">PXFG (Pseudoexfoliation Glaucoma)</option>
                  <option value="PG">PG (Pigmentary Glaucoma)</option>
                  <option value="JG">JG (Juvenile Glaucoma)</option>
                  <option value="PACG_PI">PACG s/p PI (Primary Angle-Closure Glaucoma status post Peripheral Iridotomy)</option>
                  <option value="NTG">NTG (Normal Tension Glaucoma)</option>
                  <option value="OHT">OHT (Ocular Hypertension)</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-cancel">
                Cancel
              </button>
              <button type="submit" disabled={addLoading} className="btn-submit">
                {addLoading ? 'Adding...' : 'Add Patient'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : filteredPatients.length === 0 ? (
        <EmptyState message="No patients found" />
      ) : (
        <div className="patients-grid">
          {filteredPatients.map((patient) => (
            <div
              key={patient.id}
              className="patient-card"
              onClick={() => onSelectPatient(patient.id)}
            >
              <div className="card-top">
                <div className="patient-avatar">
                  {patient.name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div className="patient-main-info">
                  <h3 className="patient-name">{patient.name}</h3>
                  <span className="patient-id">{patient.patient_id}</span>
                </div>
              </div>
              
              <div className="patient-details">
                <div className="detail-item">
                  <span className="detail-label">Age:</span>
                  <span className="detail-value">{patient.age || 'N/A'}</span>
                </div>
                <div className="detail-divider">|</div>
                <div className="detail-item">
                  <span className="detail-label">Type:</span>
                  <span className="detail-value">{getGlaucomaTypeFullForm(patient.glaucoma_type)}</span>
                </div>
              </div>
              
              <button className="view-button">
                <span>View Details</span>
                <span className="button-arrow">→</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PatientList;
