import React, { useState, useEffect } from 'react';
import { riskService } from '../services/api';
import '../styles/VisitHistory.css';

/**
 * VisitHistory Component
 * Displays patient visit history with risk assessments and clinical notes
 */
function VisitHistory({ patientId }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedVisit, setExpandedVisit] = useState(null);

  useEffect(() => {
    fetchVisits();
  }, [patientId]);

  const fetchVisits = async () => {
    if (!patientId) return;
    
    setLoading(true);
    setError('');
    
    try {
      const data = await riskService.getVisits(patientId, 50);
      setVisits(data);
    } catch (err) {
      setError('Failed to load visit history');
      console.error('Error fetching visits:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVisitTypeIcon = (type) => {
    switch (type) {
      case 'ROUTINE': return '📅';
      case 'URGENT': return '⚡';
      case 'EMERGENCY': return '🚨';
      default: return '🏥';
    }
  };

  const getVisitTypeLabel = (type) => {
    switch (type) {
      case 'ROUTINE': return 'Routine Visit';
      case 'URGENT': return 'Urgent Visit';
      case 'EMERGENCY': return 'Emergency Visit';
      default: return type || 'Visit';
    }
  };

  const getRiskLevelClass = (level) => {
    switch (level?.toUpperCase()) {
      case 'LOW': return 'risk-low';
      case 'MODERATE': return 'risk-moderate';
      case 'HIGH': return 'risk-high';
      default: return '';
    }
  };

  const getRiskIcon = (level) => {
    switch (level?.toUpperCase()) {
      case 'LOW': return '🟢';
      case 'MODERATE': return '🟡';
      case 'HIGH': return '🔴';
      default: return '⚪';
    }
  };

  const toggleExpand = (visitId) => {
    setExpandedVisit(expandedVisit === visitId ? null : visitId);
  };

  if (loading) {
    return (
      <div className="visit-history-loading">
        <div className="loading-spinner"></div>
        <p>Loading visit history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="visit-history-error">
        <span className="error-icon">⚠️</span>
        <p>{error}</p>
        <button onClick={fetchVisits} className="retry-button">
          🔄 Retry
        </button>
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="visit-history-empty">
        <div className="empty-icon">📋</div>
        <h3>No Visit Records</h3>
        <p>No visits have been recorded for this patient yet.</p>
        <p className="hint">Click "New Visit" to create the first visit record.</p>
      </div>
    );
  }

  return (
    <div className="visit-history">
      <div className="visit-history-header">
        <h3>📋 Visit History</h3>
        <span className="visit-count">{visits.length} visit{visits.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="visits-timeline">
        {visits.map((visit, index) => (
          <div 
            key={visit.id} 
            className={`visit-card ${expandedVisit === visit.id ? 'expanded' : ''}`}
          >
            <div className="visit-timeline-marker">
              <div className="marker-dot"></div>
              {index < visits.length - 1 && <div className="marker-line"></div>}
            </div>

            <div className="visit-content" onClick={() => toggleExpand(visit.id)}>
              <div className="visit-header">
                <div className="visit-type">
                  <span className="type-icon">{getVisitTypeIcon(visit.visit_type)}</span>
                  <span className="type-label">{getVisitTypeLabel(visit.visit_type)}</span>
                </div>
                <div className="visit-date">
                  {formatDate(visit.visit_date)}
                </div>
              </div>

              <div className="visit-summary">
                {visit.risk_level && (
                  <div className={`risk-badge ${getRiskLevelClass(visit.risk_level)}`}>
                    <span className="risk-icon">{getRiskIcon(visit.risk_level)}</span>
                    <span className="risk-label">{visit.risk_level} Risk</span>
                    {visit.risk_score !== null && (
                      <span className="risk-score">({visit.risk_score}%)</span>
                    )}
                  </div>
                )}
                
                {visit.recommended_followup_days && (
                  <div className="followup-badge">
                    <span className="followup-icon">📅</span>
                    <span>Follow-up in {visit.recommended_followup_days} days</span>
                  </div>
                )}
              </div>

              <div className="expand-indicator">
                {expandedVisit === visit.id ? '▲ Less Details' : '▼ More Details'}
              </div>

              {expandedVisit === visit.id && (
                <div className="visit-details">
                  {visit.findings && (
                    <div className="detail-section">
                      <h4>🔍 Clinical Findings</h4>
                      <p>{visit.findings}</p>
                    </div>
                  )}

                  {visit.treatment_changes && (
                    <div className="detail-section">
                      <h4>💊 Treatment Changes</h4>
                      <p>{visit.treatment_changes}</p>
                    </div>
                  )}

                  {visit.doctor_notes && (
                    <div className="detail-section">
                      <h4>📝 Doctor's Notes</h4>
                      <p>{visit.doctor_notes}</p>
                    </div>
                  )}

                  {visit.created_by && (
                    <div className="visit-meta">
                      <span className="meta-item">
                        <span className="meta-icon">👨‍⚕️</span>
                        {visit.created_by}
                      </span>
                    </div>
                  )}

                  {!visit.findings && !visit.treatment_changes && !visit.doctor_notes && (
                    <p className="no-details">No additional details recorded for this visit.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VisitHistory;
export { VisitHistory };
