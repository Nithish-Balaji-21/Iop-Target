import React from 'react';
import '../styles/Common.css';

/**
 * Risk Badge Component - Shows risk level with color coding
 */
export const RiskBadge = ({ riskLevel, score }) => {
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

  return (
    <div className={`risk-badge ${getRiskColor(riskLevel)}`}>
      <div className="risk-icon">⚠️</div>
      <div className="risk-info">
        <div className="risk-level">{riskLevel || 'Unknown'}</div>
        {score !== undefined && <div className="risk-score">Score: {score}/100</div>}
      </div>
    </div>
  );
};

/**
 * Status Indicator Component
 */
export const StatusIndicator = ({ status, value, target }) => {
  const getStatusIcon = (s) => {
    switch (s?.toUpperCase()) {
      case 'WITHIN_TARGET':
      case 'CONTROLLED':
        return '✓';
      case 'ABOVE_TARGET':
      case 'CRITICAL':
        return '✕';
      default:
        return '?';
    }
  };

  const getStatusClass = (s) => {
    switch (s?.toUpperCase()) {
      case 'WITHIN_TARGET':
      case 'CONTROLLED':
        return 'status-within-target';
      case 'ABOVE_TARGET':
      case 'CRITICAL':
        return 'status-above-target';
      default:
        return 'status-unknown';
    }
  };

  return (
    <div className={`status-indicator ${getStatusClass(status)}`}>
      <span className="status-icon">{getStatusIcon(status)}</span>
      {value !== undefined && <span className="status-value">{value}</span>}
      {target !== undefined && <span className="status-target">/ {target}</span>}
    </div>
  );
};

/**
 * Info Card Component
 */
export const InfoCard = ({ title, value, unit, icon, className }) => {
  return (
    <div className={`info-card ${className || ''}`}>
      {icon && <div className="card-icon">{icon}</div>}
      <div className="card-content">
        <div className="card-title">{title}</div>
        <div className="card-value">
          {value}
          {unit && <span className="card-unit">{unit}</span>}
        </div>
      </div>
    </div>
  );
};

/**
 * Alert Component
 */
export const Alert = ({ type, message, onClose }) => {
  const alertClass = `alert alert-${type}`;

  return (
    <div className={alertClass}>
      <span>{message}</span>
      {onClose && (
        <button className="alert-close" onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  );
};

/**
 * Loading Spinner
 */
export const LoadingSpinner = () => {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading...</p>
    </div>
  );
};

/**
 * Empty State Component
 */
export const EmptyState = ({ message, icon = '📭' }) => {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <p>{message}</p>
    </div>
  );
};
