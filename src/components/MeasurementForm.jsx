import React, { useState } from 'react';
import { measurementService } from '../services/api';
import '../styles/Forms.css';

function MeasurementForm({ patientId, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    iop_od: '',
    iop_os: '',
    measurement_date: new Date().toISOString().slice(0, 16),
    measured_by: '',
    device_type: 'Goldmann',
    oct_rnfl_od: '',
    oct_rnfl_os: '',
    vf_md_od: '',
    vf_md_os: '',
    clinical_notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value === '' ? '' : value,
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
      const dateTimeStr = formData.measurement_date.includes(':') ? 
        formData.measurement_date + ':00' : 
        formData.measurement_date;
      
      const payload = {
        patient_id: parseInt(patientId),
        measurement_date: dateTimeStr,
        iop_od: formData.iop_od ? parseFloat(formData.iop_od) : null,
        iop_os: formData.iop_os ? parseFloat(formData.iop_os) : null,
        measured_by: formData.measured_by || null,
        device_type: formData.device_type || null,
        oct_rnfl_od: formData.oct_rnfl_od ? parseFloat(formData.oct_rnfl_od) : null,
        oct_rnfl_os: formData.oct_rnfl_os ? parseFloat(formData.oct_rnfl_os) : null,
        vf_md_od: formData.vf_md_od ? parseFloat(formData.vf_md_od) : null,
        vf_md_os: formData.vf_md_os ? parseFloat(formData.vf_md_os) : null,
        clinical_notes: formData.clinical_notes || null,
      };

      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      await measurementService.recordMeasurement(patientId, payload);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form measurement-form" onSubmit={handleSubmit}>
      <h3>📊 Record IOP Measurement</h3>

      {error && <div className="form-error">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label>Measurement Date & Time</label>
          <input
            type="datetime-local"
            name="measurement_date"
            value={formData.measurement_date}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Right Eye IOP (OD) - mmHg</label>
          <input
            type="number"
            name="iop_od"
            placeholder="e.g., 15.5"
            value={formData.iop_od}
            onChange={handleChange}
            step="0.1"
            min="0"
            max="50"
          />
        </div>
        <div className="form-group">
          <label>Left Eye IOP (OS) - mmHg</label>
          <input
            type="number"
            name="iop_os"
            placeholder="e.g., 16.2"
            value={formData.iop_os}
            onChange={handleChange}
            step="0.1"
            min="0"
            max="50"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Measured By</label>
          <input
            type="text"
            name="measured_by"
            placeholder="Technician name"
            value={formData.measured_by}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label>Device Type</label>
          <select name="device_type" value={formData.device_type} onChange={handleChange}>
            <option>Goldmann</option>
            <option>Pneumotonometry</option>
            <option>Rebound</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>OCT RNFL - Right Eye (microns)</label>
        <input
          type="number"
          name="oct_rnfl_od"
          placeholder="e.g., 85"
          value={formData.oct_rnfl_od}
          onChange={handleChange}
          step="0.1"
        />
      </div>

      <div className="form-group">
        <label>OCT RNFL - Left Eye (microns)</label>
        <input
          type="number"
          name="oct_rnfl_os"
          placeholder="e.g., 87"
          value={formData.oct_rnfl_os}
          onChange={handleChange}
          step="0.1"
        />
      </div>

      <div className="form-group">
        <label>Visual Field MD - Right Eye (dB)</label>
        <input
          type="number"
          name="vf_md_od"
          placeholder="e.g., -2.5"
          value={formData.vf_md_od}
          onChange={handleChange}
          step="0.1"
        />
      </div>

      <div className="form-group">
        <label>Visual Field MD - Left Eye (dB)</label>
        <input
          type="number"
          name="vf_md_os"
          placeholder="e.g., -2.8"
          value={formData.vf_md_os}
          onChange={handleChange}
          step="0.1"
        />
      </div>

      <div className="form-group">
        <label>Clinical Notes</label>
        <textarea
          name="clinical_notes"
          placeholder="Any additional clinical observations..."
          value={formData.clinical_notes}
          onChange={handleChange}
          rows="3"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : '💾 Save Measurement'}
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

export { MeasurementForm };
