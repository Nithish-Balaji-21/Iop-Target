import React, { useState, useEffect } from 'react';
import { measurementService } from '../services/api';
import '../styles/MeasurementsTable.css';

/**
 * Measurements Table Component
 * Displays all IOP measurements with visit dates in a table format
 */
export default function MeasurementsTable({ patientId }) {
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMeasurements();
  }, [patientId]);

  const fetchMeasurements = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await measurementService.getMeasurements(patientId, 365, 100);
      setMeasurements(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysAgo = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isOutdated = (dateString) => {
    const days = getDaysAgo(dateString);
    return days !== null && days > 90;
  };

  const getStatusBadge = (iop, target) => {
    if (!iop || !target) return null;
    const diff = iop - target;
    if (diff > 0) {
      return <span className="status-badge above">Above Target</span>;
    } else if (diff >= -2) {
      return <span className="status-badge within">Within Target</span>;
    } else {
      return <span className="status-badge below">Below Target</span>;
    }
  };

  if (loading) {
    return <div className="measurements-table-loading">Loading measurements...</div>;
  }

  if (error) {
    return <div className="measurements-table-error">Error: {error}</div>;
  }

  if (measurements.length === 0) {
    return (
      <div className="measurements-table-empty">
        <p>📊 No measurements recorded yet</p>
        <p className="empty-subtitle">Measurements will appear here after IOP is entered in Investigation section or recorded via Measurements tab.</p>
      </div>
    );
  }

  return (
    <div className="measurements-table-container">
      <div className="measurements-table-header">
        <h3>📋 All IOP Measurements</h3>
        <span className="measurement-count">{measurements.length} measurement{measurements.length !== 1 ? 's' : ''}</span>
      </div>
      
      <div className="table-wrapper">
        <table className="measurements-table">
          <thead>
            <tr>
              <th className="col-date">Visit Date</th>
              <th className="col-iop">Right Eye (OD)</th>
              <th className="col-status">Status OD</th>
              <th className="col-iop">Left Eye (OS)</th>
              <th className="col-status">Status OS</th>
              <th className="col-device">Device</th>
              <th className="col-notes">Notes</th>
            </tr>
          </thead>
          <tbody>
            {measurements.map((measurement) => {
              const daysAgo = getDaysAgo(measurement.measurement_date);
              const outdated = isOutdated(measurement.measurement_date);
              
              return (
                <tr key={measurement.id} className={outdated ? 'outdated-row' : ''}>
                  <td className="col-date">
                    <div className="date-cell">
                      <span className="date-value">{formatDate(measurement.measurement_date)}</span>
                      {daysAgo !== null && (
                        <span className={`days-ago ${outdated ? 'outdated' : ''}`}>
                          {daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`}
                          {outdated && <span className="outdated-badge">⚠️ &gt;90 days</span>}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="col-iop">
                    {measurement.iop_od !== null && measurement.iop_od !== undefined ? (
                      <span className="iop-value">{measurement.iop_od.toFixed(1)} mmHg</span>
                    ) : (
                      <span className="no-data">—</span>
                    )}
                  </td>
                  <td className="col-status">
                    {getStatusBadge(measurement.iop_od, measurement.target_iop_od)}
                  </td>
                  <td className="col-iop">
                    {measurement.iop_os !== null && measurement.iop_os !== undefined ? (
                      <span className="iop-value">{measurement.iop_os.toFixed(1)} mmHg</span>
                    ) : (
                      <span className="no-data">—</span>
                    )}
                  </td>
                  <td className="col-status">
                    {getStatusBadge(measurement.iop_os, measurement.target_iop_os)}
                  </td>
                  <td className="col-device">
                    <span className="device-type">{measurement.device_type || 'N/A'}</span>
                  </td>
                  <td className="col-notes">
                    <span className="notes-text" title={measurement.clinical_notes || ''}>
                      {measurement.clinical_notes ? (measurement.clinical_notes.length > 30 ? measurement.clinical_notes.substring(0, 30) + '...' : measurement.clinical_notes) : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

