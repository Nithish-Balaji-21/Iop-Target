import React from 'react';
import '../styles/RecalculationPopup.css';

/**
 * RecalculationPopup - Shows when target IOP needs recalculation
 * 
 * Triggers:
 * 1. Last measurement > 90 days old
 * 2. Mean Deviation (VF MD) changed affecting glaucoma stage
 * 3. Patient age moved to new risk tier
 * 4. Risk factors changed (glaucoma stage, disease severity)
 */
function RecalculationPopup({ 
  isOpen, 
  onClose, 
  onRecalculate,
  reasons = [],
  targetSetDate
}) {
  if (!isOpen) return null;

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'NO_TARGET':
        return '🎯';
      case 'MEASUREMENT_OUTDATED':
        return '⏰';
      case 'MD_CHANGE_OD':
      case 'MD_CHANGE_OS':
        return '👁️';
      case 'AGE_TIER_CHANGE':
        return '🎂';
      case 'STAGE_CHANGE_OD':
      case 'STAGE_CHANGE_OS':
        return '📊';
      case 'TARGET_OLD':
        return '📅';
      default:
        return '⚠️';
    }
  };

  const getSeverityClass = (severity) => {
    return `severity-${severity}`;
  };

  const highSeverityCount = reasons.filter(r => r.severity === 'high').length;
  const mediumSeverityCount = reasons.filter(r => r.severity === 'medium').length;

  return (
    <div className="recalc-popup-overlay" onClick={onClose}>
      <div className="recalc-popup" onClick={e => e.stopPropagation()}>
        <div className="recalc-popup-header">
          <div className="recalc-icon-wrapper">
            <span className="recalc-icon">🔄</span>
          </div>
          <h2>Target IOP Recalculation Recommended</h2>
          <button className="recalc-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="recalc-popup-content">
          <p className="recalc-intro">
            One or more risk factors have changed since the target IOP was last calculated. 
            Review the changes below and recalculate if needed.
          </p>

          {targetSetDate && (
            <div className="target-info">
              <span className="target-info-icon">📅</span>
              <span>Target last set: {new Date(targetSetDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
          )}

          <div className="severity-summary">
            {highSeverityCount > 0 && (
              <span className="severity-badge high">
                {highSeverityCount} Critical
              </span>
            )}
            {mediumSeverityCount > 0 && (
              <span className="severity-badge medium">
                {mediumSeverityCount} Important
              </span>
            )}
          </div>

          <div className="recalc-reasons">
            {reasons.map((reason, idx) => (
              <div key={idx} className={`reason-card ${getSeverityClass(reason.severity)}`}>
                <div className="reason-header">
                  <span className="reason-type-icon">{getTypeIcon(reason.type)}</span>
                  <span className="reason-title">{reason.title}</span>
                  <span className="severity-indicator">{getSeverityIcon(reason.severity)}</span>
                </div>
                <p className="reason-description">{reason.description}</p>
                
                {/* Additional details based on type */}
                {reason.type === 'AGE_TIER_CHANGE' && (
                  <div className="reason-detail">
                    <span className="detail-label">Risk Tier:</span>
                    <span className="detail-change">
                      {reason.previous_tier} → <strong>{reason.current_tier}</strong>
                    </span>
                  </div>
                )}
                
                {(reason.type === 'MD_CHANGE_OD' || reason.type === 'MD_CHANGE_OS') && (
                  <div className="reason-detail">
                    <span className="detail-label">Stage Change:</span>
                    <span className="detail-change">
                      {reason.previous_stage} → <strong>{reason.current_stage}</strong>
                    </span>
                  </div>
                )}

                {(reason.type === 'STAGE_CHANGE_OD' || reason.type === 'STAGE_CHANGE_OS') && (
                  <div className="reason-detail">
                    <span className="detail-label">New Stage:</span>
                    <span className="detail-change">
                      <strong>{reason.current_stage}</strong>
                    </span>
                  </div>
                )}

                {reason.type === 'MEASUREMENT_OUTDATED' && (
                  <div className="reason-detail">
                    <span className="detail-label">Days since measurement:</span>
                    <span className="detail-value">{reason.days_since} days</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="recalc-popup-actions">
          <button className="recalc-btn secondary" onClick={onClose}>
            Remind Me Later
          </button>
          <button className="recalc-btn primary" onClick={onRecalculate}>
            <span className="btn-icon">🎯</span>
            Recalculate Target IOP
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecalculationPopup;
