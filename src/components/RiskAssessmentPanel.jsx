import React, { useState, useEffect } from 'react';
import '../styles/Dashboard.css';

/**
 * Risk Assessment Display Component
 * Shows comprehensive risk evaluation with IOP control, progression, and recommendations
 */
export const RiskAssessmentPanel = ({ patientId }) => {
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRiskAssessment();
  }, [patientId]);

  const fetchRiskAssessment = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `http://localhost:8000/api/risk/${patientId}/assess`,
        { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.detail || `Failed with status ${response.status}`;
        
        // If not found (404) or error, show helpful message
        if (response.status === 400) {
          setError('Cannot calculate risk: Patient needs a target pressure and measurements');
          setRiskData(null);
        } else {
          console.error('Risk assessment error:', response.status, errorMsg);
          throw new Error(errorMsg);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('Risk assessment data:', data);
      setRiskData(data);
    } catch (err) {
      console.error('Fetch risk assessment error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'LOW':
        return 'risk-low';
      case 'MODERATE':
        return 'risk-moderate';
      case 'HIGH':
        return 'risk-high';
      default:
        return 'risk-unknown';
    }
  };

  const getRiskIcon = (level) => {
    switch (level?.toUpperCase()) {
      case 'LOW':
        return '✓';
      case 'MODERATE':
        return '⚠';
      case 'HIGH':
        return '⚠⚠';
      default:
        return '?';
    }
  };

  if (loading) {
    return (
      <div className="card risk-panel">
        <h3>📊 Risk Assessment</h3>
        <p className="loading">Loading risk assessment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card risk-panel error">
        <h3>📊 Risk Assessment</h3>
        <div className="error-message">
          <p>❌ {error}</p>
          <p className="hint">
            Next steps:
            <br />
            1. Use "Jampel Target IOP Calculator" to set a target
            <br />
            2. Record at least one IOP measurement
            <br />
            3. Then risk assessment will be available
          </p>
        </div>
      </div>
    );
  }

  if (!riskData) {
    return null;
  }

  return (
    <div className={`card risk-panel ${getRiskColor(riskData.risk_level)}`}>
      <h3>📊 Risk Assessment</h3>

      {/* Main Risk Display */}
      <div className="risk-main-display">
        <div className={`risk-badge-large ${getRiskColor(riskData.risk_level)}`}>
          <div className="risk-icon">{getRiskIcon(riskData.risk_level)}</div>
          <div className="risk-info">
            <div className="risk-level">{riskData.risk_level || 'UNKNOWN'}</div>
            <div className="risk-score">Score: {riskData.risk_score}/100</div>
          </div>
        </div>
      </div>

      {/* IOP Status */}
      <div className="risk-section">
        <h4>💉 IOP Control Status</h4>
        <div className={`status-box status-${riskData.current_iop_status?.toLowerCase()}`}>
          <span className="status-label">
            {riskData.current_iop_status === 'WITHIN_TARGET' ? '✓ Within Target' : '✕ Above Target'}
          </span>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="risk-section">
        <h4>⚠️ Risk Factors</h4>
        <ul className="risk-reasons">
          {riskData.reasons && riskData.reasons.length > 0 ? (
            riskData.reasons.map((reason, idx) => (
              <li key={idx}>• {reason}</li>
            ))
          ) : (
            <li>• Stable glaucoma control</li>
          )}
        </ul>
      </div>

      {/* Recommended Follow-up */}
      <div className="risk-section">
        <h4>📅 Recommended Follow-up</h4>
        <div className="followup-info">
          <div className="followup-days">
            <span className="label">Next Visit In:</span>
            <span className="value">{riskData.recommended_followup_days} days</span>
          </div>
          {riskData.recommended_actions && (
            <div className="followup-actions">
              <span className="label">Recommended Actions:</span>
              <ul>
                {riskData.recommended_actions.map((action, idx) => (
                  <li key={idx}>• {action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Interpretation */}
      {riskData.clinical_interpretation && (
        <div className="risk-section">
          <h4>📝 Clinical Notes</h4>
          <p className="clinical-text">{riskData.clinical_interpretation}</p>
        </div>
      )}

      {/* Refresh Button */}
      <button onClick={fetchRiskAssessment} className="btn btn-secondary btn-small">
        🔄 Refresh Assessment
      </button>
    </div>
  );
};

export default RiskAssessmentPanel;
