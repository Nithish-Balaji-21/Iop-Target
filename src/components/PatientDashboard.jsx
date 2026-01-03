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
import EMRPanel from './EMR/EMRPanel';
import MeasurementsTable from './MeasurementsTable';
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
  const [graphRefreshKey, setGraphRefreshKey] = useState(0); // Force remount TrendChart when data changes
  
  // 3-Month Measurement Validity State
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const [measurementValidity, setMeasurementValidity] = useState(null);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  // Target Recalculation State
  const [showRecalcPopup, setShowRecalcPopup] = useState(false);
  const [recalcReasons, setRecalcReasons] = useState([]);
  const [recalcTargetDate, setRecalcTargetDate] = useState(null);
  const [recalcDismissed, setRecalcDismissed] = useState(false);
  
  // First Visit State
  const [showFirstVisitPopup, setShowFirstVisitPopup] = useState(false);
  const [firstVisitDismissed, setFirstVisitDismissed] = useState(false);
  
  // HFA Follow-up State
  const [showHFAPopup, setShowHFAPopup] = useState(false);
  const [hfaDismissed, setHfaDismissed] = useState(false);
  
  // Target Status Card State (shows after target calculation)
  const [targetStatusCard, setTargetStatusCard] = useState(null);

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
  
  // Check if first visit (no target IOP set)
  useEffect(() => {
    const checkFirstVisit = async () => {
      // Wait for loading to complete
      if (!patientId || firstVisitDismissed || targetLoading || measurementLoading) return;
      
      // If target exists, it's not a first visit
      if (target) return;
      
      try {
        // Check if patient has any measurements
        const measurementResponse = await fetch(`http://localhost:8000/api/measurements/${patientId}/latest`);
        let hasMeasurements = false;
        if (measurementResponse.ok) {
          const measurementData = await measurementResponse.json();
          hasMeasurements = measurementData.exists === true;
        }
        
        // If no target and no measurements, it's likely first visit
        if (!target && !hasMeasurements && !firstVisitDismissed) {
          console.log('🎯 First visit detected - showing popup');
          setShowFirstVisitPopup(true);
        }
      } catch (error) {
        console.error('Error checking first visit:', error);
        // If error checking measurements, assume no measurements and show popup if no target
        if (!target && !firstVisitDismissed) {
          console.log('🎯 First visit detected (error checking measurements) - showing popup');
          setShowFirstVisitPopup(true);
        }
      }
    };
    
    // Check immediately and also after delays to ensure all data is loaded
    checkFirstVisit();
    const timer1 = setTimeout(() => {
      checkFirstVisit();
    }, 500);
    const timer2 = setTimeout(() => {
      checkFirstVisit();
    }, 1500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [patientId, target, targetLoading, measurementLoading, patientLoading, firstVisitDismissed]);
  
  // Check if HFA was not done in first visit and needs recalculation
  useEffect(() => {
    const checkHFARecalculation = async () => {
      // Wait for loading to complete
      if (!patientId || hfaDismissed || targetLoading || !target) {
        console.log('⏸️ HFA check skipped:', { patientId, hfaDismissed, targetLoading, target: !!target });
        return;
      }
      
      try {
        const response = await fetch(`http://localhost:8000/api/emr/${patientId}/risk-factors`);
        if (response.ok) {
          const result = await response.json();
          if (result.exists && result.data) {
            const meanDevOD = result.data.mean_deviation_od;
            const meanDevOS = result.data.mean_deviation_os;
            
            console.log('🔍 HFA check:', { meanDevOD, meanDevOS, target: !!target, hfaDismissed });
            
            // If HFA was "not done" in first visit and target exists, show popup
            if ((meanDevOD === 'hfa_not_done' || meanDevOS === 'hfa_not_done') && target && !hfaDismissed) {
              console.log('🎯 HFA popup triggered - showing popup');
              setShowHFAPopup(true);
            }
          }
        }
      } catch (error) {
        console.error('Error checking HFA status:', error);
      }
    };
    
    // Check immediately and after delay to ensure target is loaded
    checkHFARecalculation();
    const timer = setTimeout(() => {
      checkHFARecalculation();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [patientId, target, targetLoading, hfaDismissed]);

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
  
  // First visit popup handlers
  const handleDismissFirstVisit = () => {
    setShowFirstVisitPopup(false);
    setFirstVisitDismissed(true);
  };

  const handleCalculateTargetFirstVisit = () => {
    setShowFirstVisitPopup(false);
    setActiveTab('target-iop');
  };
  
  // HFA follow-up popup handlers
  const handleDismissHFA = () => {
    setShowHFAPopup(false);
    setHfaDismissed(true);
  };

  const handleRecalculateAfterHFA = () => {
    setShowHFAPopup(false);
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
    // Refresh trend chart after new measurement
    setGraphRefreshKey(prev => prev + 1);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const handleTargetSuccess = async (targetData) => {
    await refetchTarget();
    
    // Get current IOP measurement to compare with target
    try {
      const measurementResponse = await fetch(`http://localhost:8000/api/measurements/${patientId}/latest`);
      if (measurementResponse.ok) {
        const measurementData = await measurementResponse.json();
        if (measurementData.exists && measurementData.measurement) {
          const currentIOPOD = measurementData.measurement.iop_od;
          const currentIOPOS = measurementData.measurement.iop_os;
          const targetOD = targetData?.target_iop_od || target?.target_iop_od;
          const targetOS = targetData?.target_iop_os || target?.target_iop_os;
          
          // Calculate status for both eyes
          let statusOD = null;
          let statusOS = null;
          
          if (targetOD && currentIOPOD !== null && currentIOPOD !== undefined) {
            const diffOD = currentIOPOD - targetOD;
            if (diffOD > 0) {
              statusOD = { status: 'ABOVE_TARGET', icon: '⚠️', label: 'Above Target', current: currentIOPOD, target: targetOD };
            } else if (diffOD >= -2) {
              statusOD = { status: 'WITHIN_TARGET', icon: '✓', label: 'Within Target', current: currentIOPOD, target: targetOD };
            } else {
              statusOD = { status: 'BELOW_TARGET', icon: 'ℹ️', label: 'Below Target', current: currentIOPOD, target: targetOD };
            }
          }
          
          if (targetOS && currentIOPOS !== null && currentIOPOS !== undefined) {
            const diffOS = currentIOPOS - targetOS;
            if (diffOS > 0) {
              statusOS = { status: 'ABOVE_TARGET', icon: '⚠️', label: 'Above Target', current: currentIOPOS, target: targetOS };
            } else if (diffOS >= -2) {
              statusOS = { status: 'WITHIN_TARGET', icon: '✓', label: 'Within Target', current: currentIOPOS, target: targetOS };
            } else {
              statusOS = { status: 'BELOW_TARGET', icon: 'ℹ️', label: 'Below Target', current: currentIOPOS, target: targetOS };
            }
          }
          
          // Show status card if we have status for at least one eye
          if (statusOD || statusOS) {
            setTargetStatusCard({ od: statusOD, os: statusOS });
            // Auto-hide after 10 seconds
            setTimeout(() => setTargetStatusCard(null), 10000);
          }
          
          // Also show in success message
          let statusMessages = [];
          if (statusOD) {
            statusMessages.push(`OD: ${statusOD.label} (${statusOD.current.toFixed(1)} ${statusOD.status === 'ABOVE_TARGET' ? '>' : '≤'} ${statusOD.target.toFixed(1)} mmHg)`);
          }
          if (statusOS) {
            statusMessages.push(`OS: ${statusOS.label} (${statusOS.current.toFixed(1)} ${statusOS.status === 'ABOVE_TARGET' ? '>' : '≤'} ${statusOS.target.toFixed(1)} mmHg)`);
          }
          
          if (statusMessages.length > 0) {
            setSuccessMessage(`✓ Target IOP saved! ${statusMessages.join(' | ')}`);
          } else {
            setSuccessMessage('✓ Target IOP saved successfully!');
          }
        } else {
          setSuccessMessage('✓ Target IOP saved successfully! (No current measurement to compare)');
        }
      } else {
        setSuccessMessage('✓ Target IOP saved successfully!');
      }
    } catch (err) {
      console.error('Error checking measurement status:', err);
      setSuccessMessage('✓ Target IOP saved successfully!');
    }
    
    setTimeout(() => setSuccessMessage(''), 5000);
    // Refresh trend chart when target changes (so TrendChart can re-render with new target overlays)
    setGraphRefreshKey(prev => prev + 1);
  };

  const handleVisitSuccess = async () => {
    setSuccessMessage('Visit created successfully!');
    setShowVisitForm(false);
    setVisitRefreshKey(prev => prev + 1); // Trigger visit history refresh
    // A new visit may include new measurements/EMR -> refresh graph
    setGraphRefreshKey(prev => prev + 1);
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

      {/* Target Status Card - Shows after target calculation */}
      {targetStatusCard && (targetStatusCard.od || targetStatusCard.os) && (
        <div className="target-status-card-container">
          <div className={`target-status-card ${targetStatusCard.od?.status === 'ABOVE_TARGET' || targetStatusCard.os?.status === 'ABOVE_TARGET' ? 'above-target' : 'within-target'}`}>
            <button 
              className="status-card-close"
              onClick={() => setTargetStatusCard(null)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="status-card-header">
              <h3>🎯 Target IOP Status</h3>
              <span className="status-card-subtitle">Current IOP vs Target</span>
            </div>
            <div className="status-card-content">
              {targetStatusCard.od && (
                <div className={`status-eye-item ${targetStatusCard.od.status.toLowerCase()}`}>
                  <div className="status-eye-header">
                    <span className="eye-label">Right Eye (OD)</span>
                    <span className={`status-badge ${targetStatusCard.od.status.toLowerCase()}`}>
                      {targetStatusCard.od.icon} {targetStatusCard.od.label}
                    </span>
                  </div>
                  <div className="status-values">
                    <div className="status-value-item">
                      <span className="value-label">Current:</span>
                      <span className="value-number">{targetStatusCard.od.current.toFixed(1)} mmHg</span>
                    </div>
                    <div className="status-value-item">
                      <span className="value-label">Target:</span>
                      <span className="value-number">{targetStatusCard.od.target.toFixed(1)} mmHg</span>
                    </div>
                    <div className="status-difference">
                      {targetStatusCard.od.status === 'ABOVE_TARGET' && (
                        <span className="diff-warning">+{(targetStatusCard.od.current - targetStatusCard.od.target).toFixed(1)} mmHg above target</span>
                      )}
                      {targetStatusCard.od.status === 'WITHIN_TARGET' && (
                        <span className="diff-success">Within target range</span>
                      )}
                      {targetStatusCard.od.status === 'BELOW_TARGET' && (
                        <span className="diff-info">{(targetStatusCard.od.current - targetStatusCard.od.target).toFixed(1)} mmHg below target</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {targetStatusCard.os && (
                <div className={`status-eye-item ${targetStatusCard.os.status.toLowerCase()}`}>
                  <div className="status-eye-header">
                    <span className="eye-label">Left Eye (OS)</span>
                    <span className={`status-badge ${targetStatusCard.os.status.toLowerCase()}`}>
                      {targetStatusCard.os.icon} {targetStatusCard.os.label}
                    </span>
                  </div>
                  <div className="status-values">
                    <div className="status-value-item">
                      <span className="value-label">Current:</span>
                      <span className="value-number">{targetStatusCard.os.current.toFixed(1)} mmHg</span>
                    </div>
                    <div className="status-value-item">
                      <span className="value-label">Target:</span>
                      <span className="value-number">{targetStatusCard.os.target.toFixed(1)} mmHg</span>
                    </div>
                    <div className="status-difference">
                      {targetStatusCard.os.status === 'ABOVE_TARGET' && (
                        <span className="diff-warning">+{(targetStatusCard.os.current - targetStatusCard.os.target).toFixed(1)} mmHg above target</span>
                      )}
                      {targetStatusCard.os.status === 'WITHIN_TARGET' && (
                        <span className="diff-success">Within target range</span>
                      )}
                      {targetStatusCard.os.status === 'BELOW_TARGET' && (
                        <span className="diff-info">{(targetStatusCard.os.current - targetStatusCard.os.target).toFixed(1)} mmHg below target</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
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
        <button 
          className={`tab-button ${activeTab === 'emr' ? 'active' : ''}`}
          onClick={() => handleTabChange('emr')}
        >
          📋 EMR Data
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
            <TrendChart key={graphRefreshKey} patientId={patientId} />
            <MeasurementsTable patientId={patientId} />
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
            {target && (
              <>
                {/* Show TrendChart when target is calculated */}
                <div style={{ marginTop: '2rem' }}>
                  <TrendChart key={graphRefreshKey} patientId={patientId} />
                </div>
                {measurement && (
                  <TargetIOPDisplay 
                    patientId={patientId}
                    measurement={measurement}
                    target={target}
                  />
                )}
              </>
            )}
            {!target && (
              <div className="warning-message">
                <p>📋 To view target comparison and graph, please:</p>
                <ul>
                  <li>Calculate a target IOP using the calculator above</li>
                  <li>Record a measurement in the Measurements tab or enter IOP in Investigation section</li>
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

        {/* EMR Tab */}
        {activeTab === 'emr' && (
          <div className="emr-tab">
            <EMRPanel 
              patientId={patientId}
              onDataSaved={() => {
                setSuccessMessage('EMR data saved! You can now use "Auto-populate from EMR" in Target IOP Calculator.');
                // Refresh charts/targets since EMR changes may affect calculations
                setGraphRefreshKey(prev => prev + 1);
                setTimeout(() => setSuccessMessage(''), 5000);
              }}
            />
            <div className="emr-help-note">
              <p>💡 <strong>Tip:</strong> After entering EMR data, go to the <strong>Target IOP</strong> tab and click 
              <strong> "📥 Auto-populate from EMR"</strong> to automatically fill risk factor fields.</p>
            </div>
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
      
      {/* First Visit Popup - Calculate Target IOP */}
      {showFirstVisitPopup && !firstVisitDismissed && (
        <div className="popup-overlay">
          <div className="popup-content first-visit-popup">
            <div className="popup-header">
              <h3>🎯 First Visit - Calculate Target IOP</h3>
              <button className="popup-close" onClick={handleDismissFirstVisit}>×</button>
            </div>
            <div className="popup-body">
              <div className="popup-icon">📋</div>
              <div className="popup-message">
                <p>
                  <strong>Welcome!</strong> This appears to be the patient's first visit.
                </p>
                <p>
                  Please calculate <strong>baseline IOP</strong> and <strong>target IOP</strong> to establish treatment goals.
                </p>
                <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
                  <li>Go to <strong>"Complaints"</strong> section to calculate baseline IOP</li>
                  <li>Then navigate to <strong>"Target IOP"</strong> tab to calculate the target IOP</li>
                </ol>
              </div>
            </div>
            <div className="popup-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleDismissFirstVisit}
              >
                Later
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleCalculateTargetFirstVisit}
              >
                Calculate Target IOP Now
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* HFA Follow-up Popup - Recalculate after HFA */}
      {showHFAPopup && !hfaDismissed && (
        <div className="popup-overlay">
          <div className="popup-content hfa-popup">
            <div className="popup-header">
              <h3>⚠️ HFA Not Done in First Visit</h3>
              <button className="popup-close" onClick={handleDismissHFA}>×</button>
            </div>
            <div className="popup-body">
              <div className="popup-icon">🔍</div>
              <div className="popup-message">
                <p>
                  <strong>Important Notice:</strong> The Humphrey Field Analyzer (HFA) was not 
                  performed during the first visit.
                </p>
                <p>
                  The current Target IOP calculation may not be ideal because it was calculated 
                  without visual field data (Mean Deviation).
                </p>
                <p>
                  <strong>Recommendation:</strong> After performing HFA in this follow-up visit, 
                  please <strong>recalculate the Target IOP</strong> to ensure accurate risk 
                  assessment and treatment goals.
                </p>
              </div>
            </div>
            <div className="popup-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleDismissHFA}
              >
                Dismiss
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleRecalculateAfterHFA}
              >
                Recalculate Target IOP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatientDashboard;