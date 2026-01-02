import React, { useState, useEffect } from 'react';
import { usePatient, useLatestMeasurement, useCurrentTarget } from '../hooks';
import { StatusIndicator, InfoCard, LoadingSpinner, Alert } from './Common';
import TrendChart from './TrendChart';
import { MeasurementForm } from './MeasurementForm';
import { VisitForm } from './VisitForm';
import { VisitHistory } from './VisitHistory';
import TargetIOPCalculator from './TargetIOPCalculator';
import TargetIOPDisplay from './TargetIOPDisplay';
import RecalculationPopup from './RecalculationPopup';
import '../styles/PatientDashboard.css';

// Helper function to get glaucoma type full form
const getGlaucomaTypeFullForm = (type) => {
  const types = {
    'POAG': 'POAG (Primary Open-Angle Glaucoma)',
    'PXFG': 'PXFG (Pseudoexfoliation Glaucoma)',
    'PG': 'PG (Pigmentary Glaucoma)',
    'JG': 'JG (Juvenile Glaucoma)',
    'PACG_PI': 'PACG s/p PI (Primary Angle-Closure Glaucoma s/p Peripheral Iridotomy)',
    'NTG': 'NTG (Normal Tension Glaucoma)',
    'OHT': 'OHT (Ocular Hypertension)',
    // Legacy types for backward compatibility
    'PACG': 'PACG (Primary Angle-Closure Glaucoma)',
    'SECONDARY': 'Secondary Glaucoma',
    'CONGENITAL': 'Congenital Glaucoma'
  };
  return types[type] || type || 'N/A';
};

function PatientDashboard({ patientId, onBack }) {
  const { patient, loading: patientLoading } = usePatient(patientId);
  const { measurement, loading: measurementLoading, refetch: refetchMeasurement } = useLatestMeasurement(patientId);
  const { target, loading: targetLoading, refetch: refetchTarget } = useCurrentTarget(patientId);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [successMessage, setSuccessMessage] = useState('');
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitRefreshKey, setVisitRefreshKey] = useState(0); // For refreshing visit history
  
  // 3-Month Measurement Validity State
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const [measurementValidity, setMeasurementValidity] = useState(null);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  // Target Recalculation State
  const [showRecalcPopup, setShowRecalcPopup] = useState(false);
  const [recalcReasons, setRecalcReasons] = useState([]);
  const [recalcTargetDate, setRecalcTargetDate] = useState(null);
  const [recalcDismissed, setRecalcDismissed] = useState(false);

  // Check target recalculation needed on mount and when target/measurement changes
  useEffect(() => {
    const checkRecalculationNeeded = async () => {
      if (!patientId || recalcDismissed) return;
      try {
        const response = await fetch(`http://localhost:8000/api/targets/${patientId}/recalculation-check`);
        if (response.ok) {
          const data = await response.json();
          if (data.needs_recalculation && data.reasons.length > 0) {
            setRecalcReasons(data.reasons);
            setRecalcTargetDate(data.target_set_date);
            // Only auto-show if there are high severity reasons
            const hasHighSeverity = data.reasons.some(r => r.severity === 'high');
            if (hasHighSeverity) {
              setShowRecalcPopup(true);
            }
          }
        }
      } catch (error) {
        console.error('Error checking recalculation:', error);
      }
    };
    checkRecalculationNeeded();
  }, [patientId, target, measurement, recalcDismissed]);

  // Check measurement validity on mount and when measurement changes
  useEffect(() => {
    const checkMeasurementValidity = async () => {
      if (!patientId || reminderDismissed) return;
      try {
        const response = await fetch(`http://localhost:8000/api/measurements/${patientId}/validity-check`);
        if (response.ok) {
          const data = await response.json();
          setMeasurementValidity(data);
          // Auto-show popup if measurement needs update and hasn't been dismissed
          if (data.needs_new_measurement && !reminderDismissed) {
            setShowReminderPopup(true);
          }
        }
      } catch (error) {
        console.error('Error checking measurement validity:', error);
      }
    };
    checkMeasurementValidity();
  }, [patientId, measurement, reminderDismissed]);

  // Check if measurement is outdated (older than 3 months)
  const isMeasurementOutdated = () => {
    if (measurementValidity) return measurementValidity.needs_new_measurement;
    if (!measurement) return false;
    const measurementDate = new Date(measurement.measurement_date);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return measurementDate < threeMonthsAgo;
  };

  const getMeasurementAge = () => {
    if (measurementValidity?.days_since_measurement) {
      const days = measurementValidity.days_since_measurement;
      if (days < 30) return `${days} days ago`;
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    }
    if (!measurement) return null;
    const measurementDate = new Date(measurement.measurement_date);
    const now = new Date();
    const diffDays = Math.floor((now - measurementDate) / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  };

  const handleDismissReminder = () => {
    setShowReminderPopup(false);
    setReminderDismissed(true);
  };

  const handleRecordMeasurement = () => {
    setShowReminderPopup(false);
    setActiveTab('measurements');
    setShowMeasurementForm(true);
  };

  // Recalculation popup handlers
  const handleDismissRecalc = () => {
    setShowRecalcPopup(false);
    setRecalcDismissed(true);
  };

  const handleRecalculateTarget = () => {
    setShowRecalcPopup(false);
    setActiveTab('target-iop');
  };

  if (patientLoading) return <LoadingSpinner />;
  if (!patient) return <div className="error-message">Patient not found</div>;

  const handleMeasurementSuccess = async (hfaChanged = false) => {
    if (hfaChanged) {
      setSuccessMessage('Measurement recorded! HFA values changed - please re-calculate Target IOP.');
      // Auto-switch to target tab after short delay
      setTimeout(() => {
        setActiveTab('target-iop');
      }, 2000);
    } else {
      setSuccessMessage('Measurement recorded successfully!');
    }
    setShowMeasurementForm(false);
    await refetchMeasurement();
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const handleTargetSuccess = async () => {
    setSuccessMessage('Target IOP updated successfully!');
    await refetchTarget();
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleVisitSuccess = async () => {
    setSuccessMessage('Visit created successfully!');
    setShowVisitForm(false);
    setVisitRefreshKey(prev => prev + 1); // Trigger visit history refresh
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowVisitForm(false);  // Close any open forms when switching tabs
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

      {/* Measurement Outdated Alert */}
      {isMeasurementOutdated() && (
        <div className="alert-banner outdated">
          <div className="alert-icon">⏰</div>
          <div className="alert-content">
            <strong>Measurement Outdated!</strong>
            <p>Last measurement was {getMeasurementAge()}. Please record a new measurement for accurate assessment.</p>
          </div>
          <button 
            className="alert-action"
            onClick={() => { setActiveTab('measurements'); setShowMeasurementForm(true); }}
          >
            Record New Measurement
          </button>
        </div>
      )}

      {/* No Target Alert */}
      {!targetLoading && !target && (
        <div className="alert-banner warning">
          <div className="alert-icon">🎯</div>
          <div className="alert-content">
            <strong>Target IOP Not Set</strong>
            <p>Calculate individualized target IOP using TRBS (Total Risk Burden Score) assessment.</p>
          </div>
          <button 
            className="alert-action"
            onClick={() => setActiveTab('target-iop')}
          >
            Calculate Target IOP
          </button>
        </div>
      )}

      {/* Target Recalculation Alert */}
      {recalcReasons.length > 0 && target && !showRecalcPopup && (
        <div className="alert-banner recalc">
          <div className="alert-icon">🔄</div>
          <div className="alert-content">
            <strong>Target IOP Recalculation Recommended</strong>
            <p>
              {recalcReasons.length} change{recalcReasons.length > 1 ? 's' : ''} detected since target was last set. 
              {recalcReasons.some(r => r.severity === 'high') && ' Includes critical changes.'}
            </p>
          </div>
          <button 
            className="alert-action"
            onClick={() => setShowRecalcPopup(true)}
          >
            Review Changes
          </button>
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
          value={getGlaucomaTypeFullForm(patient.glaucoma_type)} 
          icon="👁️"
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
          onClick={() => handleTabChange('overview')}
        >
          📋 Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'measurements' ? 'active' : ''}`}
          onClick={() => handleTabChange('measurements')}
        >
          📊 Measurements
        </button>
        <button 
          className={`tab-button ${activeTab === 'target-iop' ? 'active' : ''}`}
          onClick={() => handleTabChange('target-iop')}
        >
          🎯 Target IOP
        </button>
        <button 
          className={`tab-button ${activeTab === 'visits' ? 'active' : ''}`}
          onClick={() => handleTabChange('visits')}
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
                <div className={`measurement-display ${isMeasurementOutdated() ? 'outdated' : ''}`}>
                  {isMeasurementOutdated() && (
                    <div className="outdated-badge">⚠️ OUTDATED - Please update</div>
                  )}
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
                    <span className="measurement-age">({getMeasurementAge()})</span>
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
                onCancel={() => setShowMeasurementForm(false)}
                previousMeasurement={measurement}
                isFollowUp={measurement !== null}
              />
            )}
          </div>
        )}

        {/* Target IOP Tab */}
        {activeTab === 'target-iop' && (
          <div className="target-iop-tab">
            <TargetIOPCalculator 
              patientId={patientId}
              onTargetCalculated={handleTargetSuccess}
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

        {/* Visits Tab */}
        {activeTab === 'visits' && (
          <div className="visits-tab">
            <div className="visits-header">
              <button 
                className="action-button primary"
                onClick={() => setShowVisitForm(!showVisitForm)}
              >
                {showVisitForm ? '✕ Cancel' : '➕ New Visit'}
              </button>
            </div>
            
            {showVisitForm && (
              <VisitForm 
                patientId={patientId}
                onSuccess={handleVisitSuccess}
                onCancel={() => setShowVisitForm(false)}
              />
            )}
            
            <VisitHistory 
              key={visitRefreshKey}
              patientId={patientId} 
            />
          </div>
        )}
      </div>

      {/* Measurement Form Modal */}
      {showMeasurementForm && activeTab !== 'measurements' && (
        <div className="form-container">
          <MeasurementForm 
            patientId={patientId}
            onSuccess={handleMeasurementSuccess}
            onCancel={() => setShowMeasurementForm(false)}
            previousMeasurement={measurement}
            isFollowUp={measurement !== null}
          />
        </div>
      )}

      {/* 3-Month Measurement Reminder Popup */}
      {showReminderPopup && measurementValidity?.needs_new_measurement && (
        <div className="modal-overlay">
          <div className="reminder-popup">
            <div className="popup-header warning">
              <span className="popup-icon">⏰</span>
              <h3>Measurement Update Required</h3>
            </div>
            <div className="popup-content">
              <div className="validity-info">
                <div className="info-row">
                  <span className="label">Last Measurement:</span>
                  <span className="value">
                    {measurementValidity.last_measurement_date 
                      ? new Date(measurementValidity.last_measurement_date).toLocaleDateString()
                      : 'Never recorded'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Days Since:</span>
                  <span className="value warning">
                    {measurementValidity.days_since_measurement || 'N/A'} days
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Status:</span>
                  <span className="value status-badge invalid">
                    {measurementValidity.is_valid ? '✓ Valid' : '⚠️ Invalid (>90 days)'}
                  </span>
                </div>
              </div>
              
              <div className="reminder-message">
                <p>
                  <strong>Important:</strong> IOP measurements should be taken at least every 
                  <strong> 3 months (90 days)</strong> to ensure accurate monitoring and target 
                  IOP assessment.
                </p>
                <p>
                  Outdated measurements may not reflect the current state of the patient's 
                  intraocular pressure and could affect treatment decisions.
                </p>
              </div>
            </div>
            <div className="popup-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleDismissReminder}
              >
                Remind Me Later
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleRecordMeasurement}
              >
                📊 Record New Measurement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target IOP Recalculation Popup */}
      <RecalculationPopup
        isOpen={showRecalcPopup}
        onClose={handleDismissRecalc}
        onRecalculate={handleRecalculateTarget}
        reasons={recalcReasons}
        targetSetDate={recalcTargetDate}
      />
    </div>
  );
}

export default PatientDashboard;
