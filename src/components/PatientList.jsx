import React, { useState } from 'react';
import { usePatients } from '../hooks';
import { LoadingSpinner, EmptyState } from './Common';
import '../styles/PatientList.css';

function PatientList({ onSelectPatient }) {
  const { patients, loading, error } = usePatients();
  const [searchTerm, setSearchTerm] = useState('');

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
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

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
              <div className="patient-header">
                <h3>{patient.name}</h3>
                <span className="patient-id">{patient.patient_id}</span>
              </div>
              <div className="patient-info">
                <div className="info-row">
                  <span className="label">Age:</span>
                  <span className="value">{patient.age || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Type:</span>
                  <span className="value">{patient.glaucoma_type || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Severity:</span>
                  <span className={`severity ${patient.disease_severity?.toLowerCase()}`}>
                    {patient.disease_severity || 'N/A'}
                  </span>
                </div>
              </div>
              <button className="view-button">View Details →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PatientList;
