import React, { useState, useEffect } from 'react';
import { usePatients } from '../hooks';
import { LoadingSpinner, EmptyState } from './Common';
import { patientService, riskService } from '../services/api';
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
  const [validityMap, setValidityMap] = useState({});

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

      // Create patient and capture returned record
      const created = await patientService.createPatient({
        ...newPatient,
        age: newPatient.age || null
      });

      // Create an initial visit so visit_date exists for downstream calculations
      try {
        await riskService.createVisit(created.id, {
          patient_id: created.id,
          visit_date: new Date().toISOString(),
          visit_type: 'INITIAL',
          findings: 'Initial registration',
          treatment_changes: '',
          doctor_notes: '',
          created_by: 'System'
        });
      } catch (visitErr) {
        // Non-fatal: log and continue — patient creation succeeded
        // eslint-disable-next-line no-console
        console.warn('Failed to create initial visit:', visitErr.message || visitErr);
      }

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

  // Fetch validity (90-day) info for displayed patients
  useEffect(() => {
    let mounted = true;
    const fetchValidityForPatients = async () => {
      if (!filteredPatients || filteredPatients.length === 0) return;
      const map = {};
      await Promise.all(
        filteredPatients.map(async (p) => {
          try {
            const res = await fetch(`http://localhost:8000/api/measurements/${p.id}/validity-check`);
            if (!res.ok) return;
            const data = await res.json();
            map[p.id] = data;
          } catch (err) {
            // ignore per-patient errors
          }
        })
      );
      if (mounted) setValidityMap(map);
    };

    fetchValidityForPatients();
    return () => { mounted = false; };
  }, [filteredPatients]);

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
                <div className="detail-divider">|</div>
                <div className="detail-item measurement-reminder">
                  {validityMap[patient.id] ? (
                    validityMap[patient.id].has_measurement ? (
                      validityMap[patient.id].is_valid ? (
                        <span className="detail-value">Last {validityMap[patient.id].days_since_measurement}d • OK</span>
                      ) : (
                        <span className="detail-value overdue">Overdue by {Math.max(0, -validityMap[patient.id].days_until_due)}d</span>
                      )
                    ) : (
                      <span className="detail-value overdue">No measurements</span>
                    )
                  ) : (
                    <span className="detail-value">—</span>
                  )}
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
