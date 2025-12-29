import React, { useState } from 'react';
import { usePatient, useLatestMeasurement, useCurrentTarget, useRiskSummary } from '../hooks';
import { RiskBadge, StatusIndicator, InfoCard, LoadingSpinner, Alert } from './Common';
import TrendChart from './TrendChart';
import { MeasurementForm } from './MeasurementForm';
import { VisitForm } from './VisitForm';
import TargetIOPCalculator from './TargetIOPCalculator';
import TargetIOPDisplay from './TargetIOPDisplay';
import RiskAssessmentPanel from './RiskAssessmentPanel';
import '../styles/Dashboard.css';
import '../styles/TargetIOP.css';

function PatientDashboard({ patientId, onBack }) {
  const { patient, loading: patientLoading } = usePatient(patientId);
  const { measurement, loading: measurementLoading, refetch: refetchMeasurement } = useLatestMeasurement(patientId);
  const { target, loading: targetLoading } = useCurrentTarget(patientId);
  const { risk, loading: riskLoading, refetch: refetchRisk } = useRiskSummary(patientId);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [successMessage, setSuccessMessage] = useState('');
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);

  if (patientLoading) return <LoadingSpinner />;
  if (!patient) return <div className="error-message">Patient not found</div>;

  const handleMeasurementSuccess = async () => {
    setSuccessMessage('Measurement recorded successfully!');
    setShowMeasurementForm(false);
    await refetchMeasurement();
    await refetchRisk();
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleVisitSuccess = async () => {
    setSuccessMessage('Visit created successfully!');
    setShowVisitForm(false);
    await refetchRisk();
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div className="patient-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <div className="patient-title">
          <h1>{patient.name}</h1>
          <span className="patient-id">{patient.patient_id}</span>
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <Alert 
          type="success" 
          message={successMessage}
          onClose={() => setSuccessMessage('')}
        />
      )}

      {/* Risk Alert */}
      {risk?.current_risk && (
        <div className="risk-alert-section">
          <RiskBadge 
            riskLevel={risk.current_risk.risk_level} 
            score={risk.current_risk.risk_score}
          />
          <div className="risk-reasons">
            <h4>⚠️ Risk Factors:</h4>
            <ul>
              {risk.current_risk.reasons?.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
            <div className="followup-info">
              <strong>Next Follow-up: </strong>
              {risk.current_risk.recommended_followup_days} days
            </div>
          </div>
        </div>
      )}

      {/* Patient Info Cards */}
      <div className="info-cards-grid">
        <InfoCard 
          title="Age" 
          value={patient.age} 
          icon="👤"
        />
        <InfoCard 
          title="Glaucoma Type" 
          value={patient.glaucoma_type || 'N/A'} 
          icon="👁️"
        />
        <InfoCard 
          title="Severity" 
          value={patient.disease_severity || 'N/A'} 
          icon="📊"
        />
        <InfoCard 
          title="Gender" 
          value={patient.gender || 'N/A'} 
          icon="⚧️"
        />
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📋 Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'measurements' ? 'active' : ''}`}
          onClick={() => setActiveTab('measurements')}
        >
          📊 Measurements
        </button>
        <button 
          className={`tab-button ${activeTab === 'target-iop' ? 'active' : ''}`}
          onClick={() => setActiveTab('target-iop')}
        >
          🎯 Target IOP
        </button>
        <button 
          className={`tab-button ${activeTab === 'risk' ? 'active' : ''}`}
          onClick={() => setActiveTab('risk')}
        >
          ⚠️ Risk Assessment
        </button>
        <button 
          className={`tab-button ${activeTab === 'visits' ? 'active' : ''}`}
          onClick={() => setActiveTab('visits')}
        >
          🏥 Visits
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Latest Measurement */}
            <div className="section">
              <h3>📏 Latest Measurement</h3>
              {measurementLoading ? (
                <LoadingSpinner />
              ) : measurement ? (
                <div className="measurement-display">
                  <div className="measurement-row">
                    <div className="measurement-item">
                      <label>Right Eye (OD)</label>
                      <div className="measurement-value">
                        <span className="iop">{measurement.iop_od}</span>
                        <span className="unit">mmHg</span>
                      </div>
                      <StatusIndicator 
                        status={measurement.pressure_status_od}
                        value={measurement.iop_od}
                        target={target?.target_iop_od}
                      />
                    </div>
                    <div className="measurement-item">
                      <label>Left Eye (OS)</label>
                      <div className="measurement-value">
                        <span className="iop">{measurement.iop_os}</span>
                        <span className="unit">mmHg</span>
                      </div>
                      <StatusIndicator 
                        status={measurement.pressure_status_os}
                        value={measurement.iop_os}
                        target={target?.target_iop_os}
                      />
                    </div>
                  </div>
                  <div className="measurement-date">
                    📅 {new Date(measurement.measurement_date).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <p>No measurements recorded yet</p>
              )}
              <button 
                className="action-button primary"
                onClick={() => setShowMeasurementForm(!showMeasurementForm)}
              >
                {showMeasurementForm ? '✕ Cancel' : '➕ Add Measurement'}
              </button>
            </div>

            {/* Target Pressure */}
            {target && (
              <div className="section">
                <h3>🎯 Target Pressures</h3>
                <div className="target-display">
                  <div className="target-item">
                    <label>Right Eye (OD)</label>
                    <span className="target-value">{target.target_iop_od} mmHg</span>
                    {target.min_iop_od && target.max_iop_od && (
                      <span className="target-range">({target.min_iop_od} - {target.max_iop_od})</span>
                    )}
                  </div>
                  <div className="target-item">
                    <label>Left Eye (OS)</label>
                    <span className="target-value">{target.target_iop_os} mmHg</span>
                    {target.min_iop_os && target.max_iop_os && (
                      <span className="target-range">({target.min_iop_os} - {target.max_iop_os})</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Measurements Tab */}
        {activeTab === 'measurements' && (
          <div className="measurements-tab">
            <TrendChart patientId={patientId} />
            {showMeasurementForm && (
              <MeasurementForm 
                patientId={patientId}
                onSuccess={handleMeasurementSuccess}
              />
            )}
          </div>
        )}

        {/* Target IOP Tab */}
        {activeTab === 'target-iop' && (
          <div className="target-iop-tab">
            <TargetIOPCalculator 
              patientId={patientId}
              onSuccess={handleMeasurementSuccess}
            />
            {measurement && target && (
              <TargetIOPDisplay 
                patientId={patientId}
                measurement={measurement}
                target={target}
              />
            )}
            {(!measurement || !target) && (
              <div className="warning-message">
                <p>📋 To view target comparison, please:</p>
                <ul>
                  <li>Calculate a target IOP using the calculator above</li>
                  <li>Record a measurement in the Measurements tab</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Risk Assessment Tab */}
        {activeTab === 'risk' && (
          <div className="risk-assessment-tab">
            <RiskAssessmentPanel patientId={patientId} />
          </div>
        )}

        {/* Visits Tab */}
        {activeTab === 'visits' && (
          <div className="visits-tab">
            <button 
              className="action-button primary"
              onClick={() => setShowVisitForm(!showVisitForm)}
            >
              {showVisitForm ? '✕ Cancel' : '➕ New Visit'}
            </button>
            {showVisitForm && (
              <VisitForm 
                patientId={patientId}
                onSuccess={handleVisitSuccess}
              />
            )}
          </div>
        )}
      </div>

      {/* Measurement Form Modal */}
      {showMeasurementForm && (
        <div className="form-container">
          <MeasurementForm 
            patientId={patientId}
            onSuccess={handleMeasurementSuccess}
            onCancel={() => setShowMeasurementForm(false)}
          />
        </div>
      )}

      {/* Visit Form Modal */}
      {showVisitForm && (
        <div className="form-container">
          <VisitForm 
            patientId={patientId}
            onSuccess={handleVisitSuccess}
            onCancel={() => setShowVisitForm(false)}
          />
        </div>
      )}
    </div>
  );
}

export default PatientDashboard;
