import React from 'react';
import '../styles/TargetIOPDisplay.css';

/**
 * Target IOP Display Component
 * Shows current target and compares actual measurement against it
 * Premium professional design with visual gauges and indicators
 */
export const TargetIOPDisplay = ({ patientId, measurement, target }) => {
  const getStatus = (measured, targetValue) => {
    if (!measured || !targetValue) return null;
    const difference = measured - targetValue;
    
    // If measured IOP is ABOVE target, it's uncontrolled (no tolerance for being above)
    if (difference > 0) {
      return { 
        status: 'ABOVE_TARGET', 
        icon: '✕', 
        label: 'Above Target',
        control: 'uncontrolled'
      };
    } else if (difference >= -2) {
      // Within 2 mmHg below target - well controlled
      return { 
        status: 'WITHIN_TARGET', 
        icon: '✓', 
        label: 'Within Target',
        control: 'controlled'
      };
    } else {
      // More than 2 mmHg below target - possible hypotony concern
      return { 
        status: 'BELOW_TARGET', 
        icon: '⚠', 
        label: 'Below Target',
        control: 'marginal'
      };
    }
  };

  // Calculate gauge position (0-100%)
  const calculateGaugePosition = (measured, targetValue) => {
    if (!measured || !targetValue) return 50;
    // Range from target-10 to target+10
    const min = targetValue - 10;
    const max = targetValue + 10;
    return Math.max(0, Math.min(100, ((measured - min) / (max - min)) * 100));
  };

  if (!target || !measurement) {
    return (
      <div className="target-display warning">
        <h3>⚠️ No Target Set</h3>
        <p>Please calculate and set a target IOP first to track pressure control.</p>
      </div>
    );
  }

  const statusOD = getStatus(measurement.iop_od, target.target_iop_od);
  const statusOS = getStatus(measurement.iop_os, target.target_iop_os);
  
  const positionOD = calculateGaugePosition(measurement.iop_od, target.target_iop_od);
  const positionOS = calculateGaugePosition(measurement.iop_os, target.target_iop_os);

  // Format rationale - remove "None stage" and "cap ≤None" if present
  const formatRationale = (rationale) => {
    if (!rationale) return 'TRBS-based target calculation';
    return rationale
      .replace(/,?\s*None stage/g, '')
      .replace(/,?\s*cap\s*≤?None/g, '')
      .replace(/\|\s*\|/g, '|')
      .replace(/^\s*\|\s*/g, '')
      .replace(/\s*\|\s*$/g, '')
      .trim() || 'TRBS-based target calculation';
  };

  return (
    <div className="target-display">
      <h3>🎯 Target IOP vs Current Measurement</h3>
      
      {/* Main Comparison Grid */}
      <div className="target-comparison">
        <div className={`comparison-eye od-comparison status-${statusOD?.status?.toLowerCase()}`}>
          <h4>Right Eye (OD)</h4>
          <div className="comparison-values">
            <div className="value-item current">
              <span className="label">Current IOP</span>
              <span className="current-value">{measurement.iop_od?.toFixed(1)} mmHg</span>
            </div>
            <div className="value-item target">
              <span className="label">Target</span>
              <span className="target-value">{target.target_iop_od?.toFixed(1)} mmHg</span>
            </div>
          </div>
          {statusOD && (
            <div className={`status-indicator status-${statusOD.status.toLowerCase()}`}>
              <span className="status-icon">{statusOD.icon}</span>
              <span className="status-text">{statusOD.label}</span>
            </div>
          )}
        </div>

        <div className={`comparison-eye os-comparison status-${statusOS?.status?.toLowerCase()}`}>
          <h4>Left Eye (OS)</h4>
          <div className="comparison-values">
            <div className="value-item current">
              <span className="label">Current IOP</span>
              <span className="current-value">{measurement.iop_os?.toFixed(1)} mmHg</span>
            </div>
            <div className="value-item target">
              <span className="label">Target</span>
              <span className="target-value">{target.target_iop_os?.toFixed(1)} mmHg</span>
            </div>
          </div>
          {statusOS && (
            <div className={`status-indicator status-${statusOS.status.toLowerCase()}`}>
              <span className="status-icon">{statusOS.icon}</span>
              <span className="status-text">{statusOS.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Pressure Gauges */}
      <div className="pressure-gauges">
        <div className="gauge-container">
          <div className="gauge-header">
            <span className="gauge-title">Right Eye (OD)</span>
            <span className="gauge-reading">{measurement.iop_od?.toFixed(1)} / {target.target_iop_od?.toFixed(1)} mmHg</span>
          </div>
          <div className="gauge-track">
            <div className="gauge-zones">
              <div className="zone low"></div>
              <div className="zone target"></div>
              <div className="zone high"></div>
            </div>
            <div className="gauge-marker" style={{ left: `${positionOD}%` }}>
              <div className="marker-dot"></div>
              <div className="marker-label">{measurement.iop_od?.toFixed(1)}</div>
            </div>
            <div className="gauge-target-line" style={{ left: '50%' }}></div>
          </div>
          <div className="gauge-labels">
            <span>Low</span>
            <span>Target ({target.target_iop_od?.toFixed(1)})</span>
            <span>High</span>
          </div>
        </div>

        <div className="gauge-container">
          <div className="gauge-header">
            <span className="gauge-title">Left Eye (OS)</span>
            <span className="gauge-reading">{measurement.iop_os?.toFixed(1)} / {target.target_iop_os?.toFixed(1)} mmHg</span>
          </div>
          <div className="gauge-track">
            <div className="gauge-zones">
              <div className="zone low"></div>
              <div className="zone target"></div>
              <div className="zone high"></div>
            </div>
            <div className="gauge-marker" style={{ left: `${positionOS}%` }}>
              <div className="marker-dot"></div>
              <div className="marker-label">{measurement.iop_os?.toFixed(1)}</div>
            </div>
            <div className="gauge-target-line" style={{ left: '50%' }}></div>
          </div>
          <div className="gauge-labels">
            <span>Low</span>
            <span>Target ({target.target_iop_os?.toFixed(1)})</span>
            <span>High</span>
          </div>
        </div>
      </div>

      {/* Target Information */}
      <div className="target-info">
        <div className="info-row">
          <span className="info-icon">📋</span>
          <span className="info-content">
            <strong>Rationale:</strong> {formatRationale(target.rationale)}
          </span>
        </div>
        <div className="info-row">
          <span className="info-icon">👤</span>
          <span className="info-content">
            <strong>Set by:</strong> {target.set_by || 'System'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TargetIOPDisplay;
