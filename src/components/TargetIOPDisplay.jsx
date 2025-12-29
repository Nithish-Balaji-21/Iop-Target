import React, { useState, useEffect } from 'react';
import '../styles/Dashboard.css';

/**
 * Target IOP Display Component
 * Shows current target and compares actual measurement against it
 */
export const TargetIOPDisplay = ({ patientId, measurement, target }) => {
  const getStatus = (measured, targetValue) => {
    const difference = measured - targetValue;
    if (difference <= 3) return { status: 'WITHIN_TARGET', icon: '✓', color: 'green' };
    return { status: 'ABOVE_TARGET', icon: '✕', color: 'red' };
  };

  if (!target || !measurement) {
    return (
      <div className="card target-display warning">
        <h3>⚠️ No Target Set</h3>
        <p>Please calculate and set a target IOP first to track pressure control.</p>
      </div>
    );
  }

  const statusOD = getStatus(measurement.iop_od || 0, target.target_iop_od || 0);
  const statusOS = getStatus(measurement.iop_os || 0, target.target_iop_os || 0);

  return (
    <div className="card target-display">
      <h3>🎯 Target IOP vs Current Measurement</h3>
      
      <div className="target-comparison">
        <div className={`comparison-eye od-comparison status-${statusOD.status.toLowerCase()}`}>
          <h4>Right Eye (OD)</h4>
          <div className="comparison-values">
            <div className="value-item">
              <span className="label">Current IOP</span>
              <span className="current-value">{measurement.iop_od?.toFixed(1)} mmHg</span>
            </div>
            <div className="value-item">
              <span className="label">Target</span>
              <span className="target-value">{target.target_iop_od?.toFixed(1)} mmHg</span>
            </div>
            <div className="value-item">
              <span className="label">Acceptable Range</span>
              <span className="range-value">
                {target.min_iop_od?.toFixed(1)} - {target.max_iop_od?.toFixed(1)}
              </span>
            </div>
          </div>
          <div className={`status-indicator status-${statusOD.status.toLowerCase()}`}>
            <span className="status-icon">{statusOD.icon}</span>
            <span className="status-text">{statusOD.status}</span>
          </div>
        </div>

        <div className={`comparison-eye os-comparison status-${statusOS.status.toLowerCase()}`}>
          <h4>Left Eye (OS)</h4>
          <div className="comparison-values">
            <div className="value-item">
              <span className="label">Current IOP</span>
              <span className="current-value">{measurement.iop_os?.toFixed(1)} mmHg</span>
            </div>
            <div className="value-item">
              <span className="label">Target</span>
              <span className="target-value">{target.target_iop_os?.toFixed(1)} mmHg</span>
            </div>
            <div className="value-item">
              <span className="label">Acceptable Range</span>
              <span className="range-value">
                {target.min_iop_os?.toFixed(1)} - {target.max_iop_os?.toFixed(1)}
              </span>
            </div>
          </div>
          <div className={`status-indicator status-${statusOS.status.toLowerCase()}`}>
            <span className="status-icon">{statusOS.icon}</span>
            <span className="status-text">{statusOS.status}</span>
          </div>
        </div>
      </div>

      <div className="target-info">
        <p className="info-label">Rationale: {target.rationale}</p>
        <p className="info-label">Set by: {target.set_by}</p>
      </div>
    </div>
  );
};

export default TargetIOPDisplay;
