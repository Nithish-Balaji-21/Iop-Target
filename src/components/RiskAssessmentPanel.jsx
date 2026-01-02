import React, { useState, useEffect } from 'react';
import '../styles/RiskAssessmentPanel.css';

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
    // Check if error is about missing prerequisites
    const isMissingPrereqs = error.includes('target') || error.includes('measurement') || error.includes('400');
    
    return (
      <div className="card risk-panel prerequisites-needed">
        <h3>📊 Risk Assessment</h3>
        
        {isMissingPrereqs ? (
          <div className="prerequisites-box">
            <div className="prereq-icon">📋</div>
            <h4>Prerequisites Required</h4>
            <p>To calculate risk assessment, please complete the following:</p>
            
            <div className="prereq-checklist">
              <div className="prereq-item">
                <span className="prereq-number">1</span>
                <div className="prereq-content">
                  <strong>Set Target IOP</strong>
                  <p>Go to "Target IOP" tab and calculate individualized target using TRBS assessment</p>
                </div>
              </div>
              <div className="prereq-item">
                <span className="prereq-number">2</span>
                <div className="prereq-content">
                  <strong>Record Measurement</strong>
                  <p>Go to "Measurements" tab and add at least one IOP measurement</p>
                </div>
              </div>
            </div>
            
            <button onClick={fetchRiskAssessment} className="btn btn-primary retry-btn">
              🔄 Check Again
            </button>
          </div>
        ) : (
          <div className="error-message">
            <p>❌ {error}</p>
            <button onClick={fetchRiskAssessment} className="btn btn-secondary retry-btn">
              🔄 Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!riskData) {
    return null;
  }

  return (
    <div className={`card risk-panel ${getRiskColor(riskData.risk_level)}`}>
      <h3 style={{ marginBottom: '2rem' }}>📊 Risk Assessment</h3>

      {/* Main Assessment Grid - 4 Columns */}
      <div className="horizontal-grid">
        {/* Risk Level */}
        <div className={`grid-item ${riskData.risk_level?.toLowerCase() === 'low' ? 'success' : riskData.risk_level?.toLowerCase() === 'moderate' ? 'warning' : 'danger'}`}>
          <div className="grid-item-label">Risk Level</div>
          <div className="grid-item-value">{getRiskIcon(riskData.risk_level)} {riskData.risk_level || 'UNKNOWN'}</div>
          <div className="grid-item-unit">Patient Risk</div>
        </div>

        {/* Risk Score */}
        <div className="grid-item info">
          <div className="grid-item-label">Risk Score</div>
          <div className="grid-item-value">{riskData.risk_score}/100</div>
          <div className="grid-item-unit">Overall Assessment</div>
        </div>

        {/* IOP Control Status */}
        <div className={`grid-item ${riskData.current_iop_status === 'WITHIN_TARGET' ? 'success' : riskData.current_iop_status === 'ABOVE_TARGET' ? 'danger' : 'warning'}`}>
          <div className="grid-item-label">IOP Control</div>
          <div className="grid-item-value">
            {riskData.current_iop_status === 'WITHIN_TARGET' && '✓'}
            {riskData.current_iop_status === 'ABOVE_TARGET' && '✕'}
            {riskData.current_iop_status === 'BELOW_TARGET' && '⚠'}
          </div>
          <div className="grid-item-unit">
            {riskData.current_iop_status === 'WITHIN_TARGET' && 'Within Target'}
            {riskData.current_iop_status === 'ABOVE_TARGET' && 'Above Target'}
            {riskData.current_iop_status === 'BELOW_TARGET' && 'Below Target'}
          </div>
        </div>

        {/* Follow-up */}
        <div className="grid-item info">
          <div className="grid-item-label">Next Follow-up</div>
          <div className="grid-item-value">{riskData.recommended_followup_days}</div>
          <div className="grid-item-unit">days</div>
        </div>
      </div>

      {/* Risk Factors */}
      {riskData.reasons && riskData.reasons.length > 0 && (
        <div className="risk-section" style={{ marginTop: '2rem' }}>
          <h4>⚠️ Risk Factors</h4>
          <ul className="risk-reasons">
            {riskData.reasons.map((reason, idx) => (
              <li key={idx}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Actions */}
      {riskData.recommended_actions && riskData.recommended_actions.length > 0 && (
        <div className="risk-section">
          <h4>📋 Recommended Actions</h4>
          <ul className="risk-reasons">
            {riskData.recommended_actions.map((action, idx) => (
              <li key={idx}>• {action}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Clinical Interpretation */}
      {riskData.clinical_interpretation && (
        <div className="risk-section">
          <h4>📝 Clinical Notes</h4>
          <p className="clinical-text" style={{ marginBottom: 0 }}>{riskData.clinical_interpretation}</p>
        </div>
      )}

      {/* Refresh Button */}
      <button onClick={fetchRiskAssessment} className="btn btn-secondary btn-small" style={{ marginTop: '2rem' }}>
        🔄 Refresh Assessment
      </button>
    </div>
  );
};

export default RiskAssessmentPanel;
