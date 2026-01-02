import React, { useState } from 'react';
import { riskService } from '../services/api';
import '../styles/VisitForm.css';

function VisitForm({ patientId, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    visit_date: new Date().toISOString().slice(0, 16),
    visit_type: 'ROUTINE',
    findings: '',
    treatment_changes: '',
    doctor_notes: '',
    created_by: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Convert datetime-local string to proper ISO 8601 format
      // Input format from datetime-local: "2025-12-13T12:30"
      // Output format needed: "2025-12-13T12:30:00" (ISO 8601)
      const dateTimeStr = formData.visit_date.includes(':') ? 
        formData.visit_date + ':00' : 
        formData.visit_date;
      
      const payload = {
        patient_id: parseInt(patientId),
        visit_date: dateTimeStr,
        visit_type: formData.visit_type || null,
        findings: formData.findings || null,
        treatment_changes: formData.treatment_changes || null,
        doctor_notes: formData.doctor_notes || null,
        created_by: formData.created_by || 'Unknown',
      };
      
      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      await riskService.createVisit(patientId, payload);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form visit-form" onSubmit={handleSubmit}>
      <h3>🏥 Create Visit Record</h3>

      {error && <div className="form-error">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label>Visit Date & Time</label>
          <input
            type="datetime-local"
            name="visit_date"
            value={formData.visit_date}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Visit Type</label>
          <select name="visit_type" value={formData.visit_type} onChange={handleChange} required>
            <option value="ROUTINE">Routine</option>
            <option value="URGENT">Urgent</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
      </div>

      <div className="form-row full">
        <div className="form-group">
          <label>Clinical Findings</label>
          <textarea
            name="findings"
            placeholder="Description of clinical findings..."
            value={formData.findings}
            onChange={handleChange}
            rows="3"
          />
        </div>
      </div>

      <div className="form-row full">
        <div className="form-group">
          <label>Treatment Changes</label>
          <textarea
            name="treatment_changes"
            placeholder="Any changes to medication or treatment plan..."
            value={formData.treatment_changes}
            onChange={handleChange}
            rows="3"
          />
        </div>
      </div>

      <div className="form-row full">
        <div className="form-group">
          <label>Doctor Notes</label>
          <textarea
            name="doctor_notes"
            placeholder="Additional doctor observations..."
            value={formData.doctor_notes}
            onChange={handleChange}
            rows="3"
          />
        </div>
      </div>

      <div className="form-row full">
        <div className="form-group">
          <label>Created By (Doctor Name)</label>
          <input
            type="text"
            name="created_by"
            placeholder="Your name"
            value={formData.created_by}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : '💾 Save Visit'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            ✕ Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export { VisitForm };
