import React, { useState, useEffect } from 'react';
import { measurementService } from '../services/api';
import '../styles/MeasurementForm.css';

// Helper function to get current local datetime in format required by datetime-local input
const getCurrentLocalDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

function MeasurementForm({ patientId, onSuccess, onCancel, previousMeasurement, isFollowUp = false }) {
  const [formData, setFormData] = useState({
    iop_od: '',
    iop_os: '',
    measurement_date: getCurrentLocalDateTime(),
    measured_by: '',
    device_type: 'Goldmann',
    vf_md_od: '',
    vf_md_os: '',
    clinical_notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newHfaDone, setNewHfaDone] = useState(false);

  // Pre-fill form for follow-up visits (but NOT HFA values - those stay empty unless new HFA done)
  useEffect(() => {
    if (isFollowUp && previousMeasurement) {
      setFormData(prev => ({
        ...prev,
        measured_by: previousMeasurement.measured_by || '',
        device_type: previousMeasurement.device_type || 'Goldmann',
        // Leave VF fields EMPTY - doctor only fills if new HFA was done
        vf_md_od: '',
        vf_md_os: '',
      }));
    }
  }, [isFollowUp, previousMeasurement]);

  // Auto-detect if new HFA values are being entered
  useEffect(() => {
    const hasNewHfaOD = formData.vf_md_od !== '' && formData.vf_md_od !== null;
    const hasNewHfaOS = formData.vf_md_os !== '' && formData.vf_md_os !== null;
    setNewHfaDone(hasNewHfaOD || hasNewHfaOS);
  }, [formData.vf_md_od, formData.vf_md_os]);

  // Check if HFA values changed significantly (≥2 dB difference)
  const isHfaSignificantChange = () => {
    if (!previousMeasurement || !newHfaDone) return false;
    
    const prevOD = previousMeasurement.vf_md_od;
    const prevOS = previousMeasurement.vf_md_os;
    const newOD = formData.vf_md_od ? parseFloat(formData.vf_md_od) : null;
    const newOS = formData.vf_md_os ? parseFloat(formData.vf_md_os) : null;
    
    const odDiff = prevOD !== null && newOD !== null ? Math.abs(prevOD - newOD) : 0;
    const osDiff = prevOS !== null && newOS !== null ? Math.abs(prevOS - newOS) : 0;
    
    return odDiff >= 2 || osDiff >= 2;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value === '' ? '' : value,
    });
  };

  // Quick negative button for VF values
  const toggleNegative = (fieldName) => {
    const currentValue = formData[fieldName];
    if (currentValue === '' || currentValue === null) return;
    
    const numValue = parseFloat(currentValue);
    if (!isNaN(numValue)) {
      setFormData({
        ...formData,
        [fieldName]: (-numValue).toString(),
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const dateTimeStr = formData.measurement_date.includes(':') ? 
        formData.measurement_date + ':00' : 
        formData.measurement_date;
      
      // If no new HFA done, use previous values
      const finalVfOD = formData.vf_md_od !== '' ? parseFloat(formData.vf_md_od) : 
                        (previousMeasurement?.vf_md_od ?? null);
      const finalVfOS = formData.vf_md_os !== '' ? parseFloat(formData.vf_md_os) : 
                        (previousMeasurement?.vf_md_os ?? null);
      
      const payload = {
        patient_id: parseInt(patientId),
        measurement_date: dateTimeStr,
        iop_od: formData.iop_od ? parseFloat(formData.iop_od) : null,
        iop_os: formData.iop_os ? parseFloat(formData.iop_os) : null,
        measured_by: formData.measured_by || null,
        device_type: formData.device_type || null,
        vf_md_od: finalVfOD,
        vf_md_os: finalVfOS,
        clinical_notes: formData.clinical_notes || null,
      };

      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      await measurementService.recordMeasurement(patientId, payload);
      
      // Pass whether HFA changed significantly to parent
      onSuccess(newHfaDone && isHfaSignificantChange());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if previous HFA values exist
  const hasPreviousHfa = previousMeasurement && 
    (previousMeasurement.vf_md_od !== null || previousMeasurement.vf_md_os !== null);

  return (
    <form className="form measurement-form" onSubmit={handleSubmit}>
      <h3>{isFollowUp ? '🔄 Follow-up Measurement' : '📊 Record IOP Measurement'}</h3>
      
      {isFollowUp && (
        <div className="followup-info">
          <p>💡 <strong>Follow-up Visit:</strong> Enter new IOP measurements. HFA (Visual Field) values will be carried forward from previous visit unless you enter new values below.</p>
        </div>
      )}

      {newHfaDone && isHfaSignificantChange() && (
        <div className="hfa-warning">
          ⚠️ <strong>HFA Values Changed Significantly (≥2 dB)!</strong> 
          <br />After saving, the system will prompt you to re-calculate Target IOP.
        </div>
      )}

      {newHfaDone && !isHfaSignificantChange() && (
        <div className="hfa-info">
          ✓ <strong>New HFA Detected:</strong> Visual field values will be updated.
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      <div className="form-row full">
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

      <div className="form-section hfa-section">
        <div className="section-header">
          <h4>📋 Visual Field (HFA) - Mean Deviation</h4>
          {isFollowUp && (
            <span className="section-hint">
              {newHfaDone ? '✓ New HFA values entered' : 'Leave empty if no new HFA done'}
            </span>
          )}
        </div>

        {/* Show previous HFA values as reference */}
        {isFollowUp && hasPreviousHfa && (
          <div className="previous-hfa-reference">
            <span className="ref-label">Previous HFA Values:</span>
            <span className="ref-value">
              OD: {previousMeasurement.vf_md_od !== null ? `${previousMeasurement.vf_md_od} dB` : 'N/A'}
            </span>
            <span className="ref-value">
              OS: {previousMeasurement.vf_md_os !== null ? `${previousMeasurement.vf_md_os} dB` : 'N/A'}
            </span>
            {!newHfaDone && <span className="ref-note">(Will be carried forward)</span>}
          </div>
        )}

        <div className="form-row">
          <div className="form-group vf-input-group">
            <label>New HFA MD - Right Eye (dB)</label>
            <div className="vf-input-wrapper">
              <input
                type="number"
                name="vf_md_od"
                placeholder={isFollowUp ? "Enter if new HFA done" : "e.g., -2.5"}
                value={formData.vf_md_od}
                onChange={handleChange}
                step="0.1"
              />
              <button 
                type="button" 
                className="toggle-sign-btn"
                onClick={() => toggleNegative('vf_md_od')}
                title="Toggle positive/negative"
              >
                ±
              </button>
            </div>
          </div>
          <div className="form-group vf-input-group">
            <label>New HFA MD - Left Eye (dB)</label>
            <div className="vf-input-wrapper">
              <input
                type="number"
                name="vf_md_os"
                placeholder={isFollowUp ? "Enter if new HFA done" : "e.g., -2.8"}
                value={formData.vf_md_os}
                onChange={handleChange}
                step="0.1"
              />
              <button 
                type="button" 
                className="toggle-sign-btn"
                onClick={() => toggleNegative('vf_md_os')}
                title="Toggle positive/negative"
              >
                ±
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="form-row full">
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
