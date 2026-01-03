import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import PatientDashboard from '../components/PatientDashboard';
import EMRPanel from '../components/EMR/EMRPanel';
import TargetIOPCalculator from '../components/TargetIOPCalculator';
import TargetIOPDisplay from '../components/TargetIOPDisplay';
import TrendChart from '../components/TrendChart';
import { History, FundusExam, Investigation, VisualField, Diagnosis, Refraction, AnteriorSegment, TargetIOP } from '../components/EMR';
import './PatientEMR.css';

// Follow Up Section Component
function FollowUpSection({ patientId, patient, doctorName }) {
    const [nextFollowUpDate, setNextFollowUpDate] = useState('');
    const [followUpNotes, setFollowUpNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [lastVisitDate, setLastVisitDate] = useState('N/A');

    // Fetch last visit date
    useEffect(() => {
        const fetchLastVisit = async () => {
            if (!patientId) return;
            try {
                const response = await fetch(`http://localhost:8000/api/risk/${patientId}/visits?limit=1`);
                if (response.ok) {
                    const visits = await response.json();
                    if (visits && visits.length > 0) {
                        const lastVisit = visits[0];
                        const visitDate = new Date(lastVisit.visit_date);
                        setLastVisitDate(visitDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        }));
                    }
                }
            } catch (err) {
                console.error('Error fetching last visit:', err);
            }
        };
        fetchLastVisit();
    }, [patientId]);

    const handleScheduleFollowUp = async () => {
        if (!nextFollowUpDate) {
            alert('Please select a follow-up date');
            return;
        }

        setSaving(true);
        setSaveMessage('');
        
        try {
            const response = await fetch(`http://localhost:8000/api/risk/${patientId}/visit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    visit_date: new Date().toISOString(), // Current visit date
                    visit_type: 'ROUTINE',
                    findings: followUpNotes || 'Follow-up scheduled',
                    treatment_changes: '',
                    doctor_notes: `Next follow-up scheduled for: ${nextFollowUpDate}. Notes: ${followUpNotes}`,
                    patient_id: patientId, // Include patient_id in body as per VisitCreate schema
                    created_by: doctorName || 'Doctor'
                })
            });

            if (response.ok) {
                const result = await response.json();
                setSaveMessage('✓ Follow-up scheduled successfully!');
                // Clear form after successful save
                setTimeout(() => {
                    setNextFollowUpDate('');
                    setFollowUpNotes('');
                    setSaveMessage('');
                }, 3000);
            } else {
                let errorMessage = 'Unknown error';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.message || JSON.stringify(errorData);
                } catch (parseErr) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                alert('Error scheduling follow-up: ' + errorMessage);
            }
        } catch (err) {
            console.error('Error scheduling follow-up:', err);
            alert('Error scheduling follow-up: ' + (err.message || 'Network error. Please check your connection.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="emr-section-content">
            <div className="followup-section">
                <h3>Follow Up</h3>
                
                {/* IOP Trend Graph */}
                <div className="followup-graph-section">
                    <h4>📊 IOP Trend Analysis</h4>
                    <div className="trend-chart-wrapper">
                        <TrendChart patientId={patientId} />
                    </div>
                </div>
                
                <div className="followup-card">
                    <div className="followup-info">
                        <p><strong>Patient:</strong> {patient?.name || 'N/A'}</p>
                        <p><strong>Glaucoma Type:</strong> {patient?.glaucoma_type || 'Not specified'}</p>
                        <p><strong>Last Visit:</strong> {lastVisitDate}</p>
                    </div>
                    <div className="followup-schedule">
                        <label>Next Follow Up Date</label>
                        <input 
                            type="date" 
                            className="followup-date-input"
                            value={nextFollowUpDate}
                            onChange={(e) => setNextFollowUpDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>
                    <div className="followup-notes">
                        <label>Notes</label>
                        <textarea 
                            placeholder="Enter follow up notes..." 
                            rows="4"
                            value={followUpNotes}
                            onChange={(e) => setFollowUpNotes(e.target.value)}
                        ></textarea>
                    </div>
                    {saveMessage && (
                        <div className="followup-success-message">{saveMessage}</div>
                    )}
                    <button 
                        className="btn-save-followup"
                        onClick={handleScheduleFollowUp}
                        disabled={saving || !nextFollowUpDate}
                    >
                        {saving ? '⏳ Scheduling...' : '📅 Schedule Follow Up'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PatientEMR({ patientId, doctorName, onBackToQueue }) {
    const [patient, setPatient] = useState(null);
    const [activeSection, setActiveSection] = useState('Diagnosis');
    const [expandedSections, setExpandedSections] = useState({
        'Initial Assessment': true,
        'Care Plan': false
    });
    const [loading, setLoading] = useState(true);
    
    // First Visit Popup State
    const [showFirstVisitPopup, setShowFirstVisitPopup] = useState(false);
    const [firstVisitDismissed, setFirstVisitDismissed] = useState(false);
    
    // Visit type and baseline IOP state
    const [visitType, setVisitType] = useState('followup');
    const [baselineIOP, setBaselineIOP] = useState({ od: '', os: '' });
    const [baselineIOPSaved, setBaselineIOPSaved] = useState(false);
    const [existingBaseline, setExistingBaseline] = useState(null);
    
    // AGM (Anti-Glaucoma Medication) state - for new visits
    const [isAlreadyOnAGM, setIsAlreadyOnAGM] = useState(false);
    const [numAGMs, setNumAGMs] = useState('0');
    const [currentTreatedIOP, setCurrentTreatedIOP] = useState({ od: '', os: '' });
    const [calculatedBaseline, setCalculatedBaseline] = useState({ od: '', os: '' });
    
    // AGM adjustment values
    const getAGMAdjustment = (num) => {
        if (num === '0') return 0;
        if (num === '1') return 5;
        if (num === '2') return 8;
        return 10; // 3 or more
    };

    // Calculate baseline when current IOP or AGM count changes
    useEffect(() => {
        if (isAlreadyOnAGM && currentTreatedIOP.od && currentTreatedIOP.os) {
            const adjustment = getAGMAdjustment(numAGMs);
            setCalculatedBaseline({
                od: (parseFloat(currentTreatedIOP.od) + adjustment).toString(),
                os: (parseFloat(currentTreatedIOP.os) + adjustment).toString()
            });
            // Also update baselineIOP for saving
            setBaselineIOP({
                od: (parseFloat(currentTreatedIOP.od) + adjustment).toString(),
                os: (parseFloat(currentTreatedIOP.os) + adjustment).toString()
            });
        }
    }, [isAlreadyOnAGM, numAGMs, currentTreatedIOP]);

    // Fetch patient data and existing baseline
    useEffect(() => {
        fetchPatientData();
        fetchExistingBaseline();
    }, [patientId]);
    
    // Check if first visit (no target IOP set) - for PatientEMR page
    useEffect(() => {
        const checkFirstVisit = async () => {
            if (!patientId || firstVisitDismissed) {
                console.log('⏸️ First visit check skipped:', { patientId, firstVisitDismissed });
                return;
            }
            
            // Wait for loading to complete
            if (loading) {
                console.log('⏳ Waiting for patient data to load...');
                return;
            }
            
            try {
                // Check if target exists
                const targetResponse = await fetch(`http://localhost:8000/api/targets/${patientId}/current`);
                let hasTarget = false;
                if (targetResponse.ok) {
                    const targetData = await targetResponse.json();
                    hasTarget = targetData && targetData.exists !== false && targetData.target_iop_od;
                    console.log('📊 Target check:', { hasTarget, targetData });
                }
                
                // Check if patient has any measurements
                const measurementResponse = await fetch(`http://localhost:8000/api/measurements/${patientId}/latest`);
                let hasMeasurements = false;
                if (measurementResponse.ok) {
                    const measurementData = await measurementResponse.json();
                    hasMeasurements = measurementData.exists === true;
                    console.log('📊 Measurement check:', { hasMeasurements, measurementData });
                }
                
                // If no target and no measurements, it's likely first visit
                if (!hasTarget && !hasMeasurements && !firstVisitDismissed) {
                    console.log('🎯 First visit detected in PatientEMR - showing popup', { hasTarget, hasMeasurements, firstVisitDismissed });
                    setShowFirstVisitPopup(true);
                } else {
                    console.log('ℹ️ Not first visit:', { hasTarget, hasMeasurements, firstVisitDismissed });
                }
            } catch (error) {
                console.error('Error checking first visit:', error);
                // If error, assume first visit if no target
                if (!firstVisitDismissed) {
                    console.log('🎯 First visit detected (error) - showing popup');
                    setShowFirstVisitPopup(true);
                }
            }
        };
        
        // Check immediately and after delays to ensure all data is loaded
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
    }, [patientId, loading, firstVisitDismissed]);

    const fetchPatientData = async () => {
        try {
            const response = await fetch(`http://localhost:8000/api/patients/${patientId}`);
            if (response.ok) {
                const data = await response.json();
                setPatient(data);
                // Check if baseline IOP already exists on patient record
                if (data.baseline_iop_od && data.baseline_iop_os) {
                    setExistingBaseline({
                        od: data.baseline_iop_od,
                        os: data.baseline_iop_os
                    });
                    setBaselineIOPSaved(true);
                }
            }
        } catch (err) {
            console.error('Error fetching patient:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch existing baseline IOP from measurements
    const fetchExistingBaseline = async () => {
        try {
            const response = await fetch(`http://localhost:8000/api/measurements/${patientId}/baseline`);
            if (response.ok) {
                const data = await response.json();
                if (data.baseline_iop_od && data.baseline_iop_os && data.source !== 'default') {
                    setExistingBaseline({
                        od: data.baseline_iop_od,
                        os: data.baseline_iop_os,
                        source: data.source
                    });
                    setBaselineIOPSaved(true);
                }
            }
        } catch (err) {
            console.error('Error fetching baseline:', err);
        }
    };

    // Save baseline IOP for new visits
    const saveBaselineIOP = async () => {
        if (!baselineIOP.od || !baselineIOP.os) {
            alert('Please enter IOP values for both eyes');
            return;
        }
        
        // Determine baseline type based on AGM status
        const isUntreated = !isAlreadyOnAGM;
        const sourceType = isAlreadyOnAGM ? 'calculated_from_agm' : 'first_visit_untreated';
        
        try {
            const response = await fetch(`http://localhost:8000/api/emr/${patientId}/baseline-iop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseline_iop_od: parseFloat(baselineIOP.od),
                    baseline_iop_os: parseFloat(baselineIOP.os),
                    visit_type: 'new',
                    is_untreated: isUntreated,
                    source: sourceType,
                    on_agm: isAlreadyOnAGM,
                    num_agm: numAGMs,
                    current_treated_iop_od: isAlreadyOnAGM ? parseFloat(currentTreatedIOP.od) : null,
                    current_treated_iop_os: isAlreadyOnAGM ? parseFloat(currentTreatedIOP.os) : null
                })
            });
            if (response.ok) {
                setBaselineIOPSaved(true);
                setExistingBaseline({
                    od: parseFloat(baselineIOP.od),
                    os: parseFloat(baselineIOP.os),
                    isUntreated: !isAlreadyOnAGM,
                    source: sourceType
                });
                const statusText = isAlreadyOnAGM ? 'Calculated (Current IOP + AGM adjustment)' : 'Untreated';
                alert(`✓ ${statusText} Baseline IOP saved! This will be used in Target IOP calculation.`);
            }
        } catch (err) {
            console.error('Error saving baseline IOP:', err);
            alert('Error saving baseline IOP');
        }
    };

    const handleSectionChange = (section) => {
        setActiveSection(section);
    };

    const handleToggleSection = (title) => {
        setExpandedSections(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    const renderContent = () => {
        switch (activeSection) {
            case 'History':
                return (
                    <div className="emr-section-content">
                        <History patientId={patientId} onSave={() => {}} />
                    </div>
                );
            case 'Fundus Exam':
                return (
                    <div className="emr-section-content">
                        <FundusExam patientId={patientId} onSave={() => {}} />
                    </div>
                );
            case 'Investigation':
                return (
                    <div className="emr-section-content">
                        <Investigation patientId={patientId} onSave={() => {}} />
                    </div>
                );
            case 'Diagnosis':
                return (
                    <div className="emr-section-content">
                        <Diagnosis patientId={patientId} onSave={() => {}} />
                    </div>
                );
            case 'Target IOP':
                return (
                    <div className="emr-section-content">
                        <TargetIOP patientId={patientId} onTargetCalculated={() => {}} />
                    </div>
                );
            case 'EMR Data':
                return (
                    <div className="emr-section-content">
                        <EMRPanel patientId={patientId} onDataSaved={() => {}} />
                    </div>
                );
            case 'Complaints':
                return (
                    <div className="emr-section-content">
                        <div className="complaints-section">
                            <h3>Visit Type</h3>
                            <div className="visit-type-options">
                                <label className="visit-type-option">
                                    <input 
                                        type="radio" 
                                        name="visitType" 
                                        value="new"
                                        checked={visitType === 'new'}
                                        onChange={(e) => setVisitType(e.target.value)}
                                    />
                                    <span className="visit-type-label new-visit">
                                        <span className="visit-icon">🆕</span>
                                        <span className="visit-text">
                                            <strong>New Visit</strong>
                                            <small>First time visit for Glaucoma</small>
                                        </span>
                                    </span>
                                </label>
                                <label className="visit-type-option">
                                    <input 
                                        type="radio" 
                                        name="visitType" 
                                        value="followup"
                                        checked={visitType === 'followup'}
                                        onChange={(e) => setVisitType(e.target.value)}
                                    />
                                    <span className="visit-type-label followup-visit">
                                        <span className="visit-icon">🔄</span>
                                        <span className="visit-text">
                                            <strong>Follow-up Visit</strong>
                                            <small>Returning for Glaucoma treatment</small>
                                        </span>
                                    </span>
                                </label>
                            </div>
                            
                            {/* Baseline IOP for New Visit */}
                            {visitType === 'new' && !existingBaseline && (
                                <div className="baseline-iop-section">
                                    <h4>📊 Baseline IOP for Target IOP Calculation</h4>
                                    
                                    {/* AGM Question */}
                                    <div className="agm-question-box">
                                        <div className="agm-question">
                                            <span className="agm-q-label">💊 Is patient already on Anti-Glaucoma Medication (AGM)?</span>
                                            <div className="agm-toggle-buttons">
                                                <button 
                                                    className={`toggle-btn ${!isAlreadyOnAGM ? 'active no' : ''}`}
                                                    onClick={() => {
                                                        setIsAlreadyOnAGM(false);
                                                        setNumAGMs('0');
                                                        setCurrentTreatedIOP({ od: '', os: '' });
                                                        setCalculatedBaseline({ od: '', os: '' });
                                                        setBaselineIOP({ od: '', os: '' });
                                                    }}
                                                    disabled={baselineIOPSaved}
                                                >
                                                    No (New/Untreated)
                                                </button>
                                                <button 
                                                    className={`toggle-btn ${isAlreadyOnAGM ? 'active yes' : ''}`}
                                                    onClick={() => setIsAlreadyOnAGM(true)}
                                                    disabled={baselineIOPSaved}
                                                >
                                                    Yes (Already Treated)
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* If NOT on AGM - Direct baseline entry */}
                                    {!isAlreadyOnAGM && (
                                        <div className="untreated-baseline-section">
                                            <p className="baseline-info">
                                                Enter the first <strong>untreated IOP</strong> measurement. This will be the baseline for Target IOP calculation.
                                            </p>
                                            <div className="baseline-iop-inputs">
                                                <div className="iop-input-group">
                                                    <label>Right Eye (OD)</label>
                                                    <div className="input-with-unit">
                                                        <input
                                                            type="number"
                                                            value={baselineIOP.od}
                                                            onChange={(e) => setBaselineIOP(prev => ({ ...prev, od: e.target.value }))}
                                                            placeholder="e.g., 24"
                                                            min="8"
                                                            max="60"
                                                            step="0.5"
                                                            disabled={baselineIOPSaved}
                                                        />
                                                        <span className="unit">mmHg</span>
                                                    </div>
                                                </div>
                                                <div className="iop-input-group">
                                                    <label>Left Eye (OS)</label>
                                                    <div className="input-with-unit">
                                                        <input
                                                            type="number"
                                                            value={baselineIOP.os}
                                                            onChange={(e) => setBaselineIOP(prev => ({ ...prev, os: e.target.value }))}
                                                            placeholder="e.g., 24"
                                                            min="8"
                                                            max="60"
                                                            step="0.5"
                                                            disabled={baselineIOPSaved}
                                                        />
                                                        <span className="unit">mmHg</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* If ON AGM - Calculate baseline from current IOP */}
                                    {isAlreadyOnAGM && (
                                        <div className="agm-baseline-section">
                                            <div className="agm-info-banner">
                                                <span className="info-icon">ℹ️</span>
                                                Patient is on treatment. System will calculate <strong>Untreated Baseline</strong> = Current IOP + AGM Adjustment
                                            </div>

                                            {/* Number of AGMs */}
                                            <div className="agm-count-row">
                                                <label>Number of AGM medications:</label>
                                                <div className="agm-count-buttons">
                                                    {['1', '2', '3'].map(num => (
                                                        <button
                                                            key={num}
                                                            className={`agm-count-btn ${numAGMs === num ? 'active' : ''}`}
                                                            onClick={() => setNumAGMs(num)}
                                                            disabled={baselineIOPSaved}
                                                        >
                                                            {num === '3' ? '≥3' : num} AGM
                                                            <span className="adjustment">+{num === '1' ? '5' : num === '2' ? '8' : '10'} mmHg</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Current Treated IOP */}
                                            <div className="current-iop-row">
                                                <label>📍 Current IOP (on treatment):</label>
                                                <div className="baseline-iop-inputs">
                                                    <div className="iop-input-group">
                                                        <span>OD:</span>
                                                        <div className="input-with-unit">
                                                            <input
                                                                type="number"
                                                                value={currentTreatedIOP.od}
                                                                onChange={(e) => setCurrentTreatedIOP(prev => ({ ...prev, od: e.target.value }))}
                                                                placeholder="e.g., 18"
                                                                min="4"
                                                                max="50"
                                                                step="0.5"
                                                                disabled={baselineIOPSaved}
                                                            />
                                                            <span className="unit">mmHg</span>
                                                        </div>
                                                    </div>
                                                    <div className="iop-input-group">
                                                        <span>OS:</span>
                                                        <div className="input-with-unit">
                                                            <input
                                                                type="number"
                                                                value={currentTreatedIOP.os}
                                                                onChange={(e) => setCurrentTreatedIOP(prev => ({ ...prev, os: e.target.value }))}
                                                                placeholder="e.g., 18"
                                                                min="4"
                                                                max="50"
                                                                step="0.5"
                                                                disabled={baselineIOPSaved}
                                                            />
                                                            <span className="unit">mmHg</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Calculation Display */}
                                            {currentTreatedIOP.od && currentTreatedIOP.os && numAGMs !== '0' && (
                                                <div className="calculation-box">
                                                    <div className="calc-header">🎯 Calculated Untreated Baseline IOP</div>
                                                    <div className="calc-formula">
                                                        <span className="formula-text">
                                                            Current IOP + {getAGMAdjustment(numAGMs)} mmHg ({numAGMs === '3' ? '≥3' : numAGMs} AGM adjustment)
                                                        </span>
                                                    </div>
                                                    <div className="calc-results">
                                                        <div className="calc-eye">
                                                            <span className="eye-label">OD (Right)</span>
                                                            <span className="calc-value">{calculatedBaseline.od} mmHg</span>
                                                            <span className="calc-detail">({currentTreatedIOP.od} + {getAGMAdjustment(numAGMs)})</span>
                                                        </div>
                                                        <div className="calc-eye">
                                                            <span className="eye-label">OS (Left)</span>
                                                            <span className="calc-value">{calculatedBaseline.os} mmHg</span>
                                                            <span className="calc-detail">({currentTreatedIOP.os} + {getAGMAdjustment(numAGMs)})</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Save Button */}
                                    {!baselineIOPSaved ? (
                                        <button 
                                            className="btn-save-baseline" 
                                            onClick={saveBaselineIOP}
                                            disabled={isAlreadyOnAGM ? (!currentTreatedIOP.od || !currentTreatedIOP.os || numAGMs === '0') : (!baselineIOP.od || !baselineIOP.os)}
                                        >
                                            💾 Save Baseline IOP
                                        </button>
                                    ) : (
                                        <div className="baseline-saved-badge">
                                            ✓ Baseline IOP Saved - Will auto-populate in Target IOP Calculator
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Show existing baseline for New Visit (already saved) */}
                            {visitType === 'new' && existingBaseline && (
                                <div className={`baseline-iop-section existing ${existingBaseline.isUntreated === false ? 'treated' : ''}`}>
                                    <h4>📊 Baseline IOP (Already Recorded) {existingBaseline.isUntreated === false && '- From AGM Calculation'}</h4>
                                    <div className="baseline-display">
                                        <div className="baseline-value">
                                            <span className="eye-label">OD (Right)</span>
                                            <span className="iop-value">{existingBaseline.od} mmHg</span>
                                        </div>
                                        <div className="baseline-value">
                                            <span className="eye-label">OS (Left)</span>
                                            <span className="iop-value">{existingBaseline.os} mmHg</span>
                                        </div>
                                    </div>
                                    <div className="baseline-saved-badge">
                                        ✓ {existingBaseline.source === 'calculated_from_agm' ? 'Calculated from AGM' : 'Untreated'} Baseline - Used in Target IOP calculation
                                    </div>
                                </div>
                            )}

                            {/* Show existing baseline for Follow-up Visit */}
                            {visitType === 'followup' && (
                                <div className={`baseline-iop-section followup-baseline ${existingBaseline?.isUntreated === false ? 'treated' : ''}`}>
                                    <h4>📊 First Visit Baseline IOP</h4>
                                    <p className="baseline-info">
                                        This is the baseline IOP from the first visit. It is used for Target IOP calculation.
                                    </p>
                                    {existingBaseline ? (
                                        <>
                                            <div className="baseline-display">
                                                <div className="baseline-value">
                                                    <span className="eye-label">OD (Right)</span>
                                                    <span className="iop-value">{existingBaseline.od} mmHg</span>
                                                </div>
                                                <div className="baseline-value">
                                                    <span className="eye-label">OS (Left)</span>
                                                    <span className="iop-value">{existingBaseline.os} mmHg</span>
                                                </div>
                                            </div>
                                            <div className="baseline-info-badge">
                                                ℹ️ Baseline IOP is fixed from first visit and used for all Target IOP calculations
                                            </div>
                                        </>
                                    ) : (
                                        <div className="no-baseline-warning">
                                            ⚠️ No baseline IOP recorded. Please record a "New Visit" first to capture the baseline IOP.
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="visit-info-box">
                                <p><strong>Patient:</strong> {patient?.name}</p>
                                <p><strong>Glaucoma Type:</strong> {patient?.glaucoma_type || 'Not specified'}</p>
                                <p><strong>Purpose:</strong> Glaucoma monitoring and IOP assessment</p>
                            </div>
                        </div>
                    </div>
                );
            case 'Refraction':
            case 'Refraction - Others':
                return (
                    <div className="emr-section-content">
                        <Refraction patientId={patientId} onDataChange={() => {}} />
                    </div>
                );
            case 'Ant. Segment Exam':
                return (
                    <div className="emr-section-content">
                        <AnteriorSegment patientId={patientId} onDataChange={() => {}} />
                    </div>
                );
            case 'Follow Up':
                return (
                    <FollowUpSection 
                        patientId={patientId} 
                        patient={patient}
                        doctorName={doctorName}
                    />
                );
            case 'Any Vulnerabilities':
            case 'Vision':
            case 'Nutritional Assess':
            case 'Anaesthesia':
            case 'Dilation':
            case 'Special Investigations':
            case 'General Anaesthesia':
                return (
                    <div className="emr-section-content placeholder">
                        <div className="placeholder-content">
                            <h3>{activeSection}</h3>
                            <p>This section is under development.</p>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="emr-section-content">
                        <Diagnosis patientId={patientId} onSave={() => {}} />
                    </div>
                );
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading patient data...</p>
            </div>
        );
    }

    return (
        <Layout
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            expandedSections={expandedSections}
            onToggleSection={handleToggleSection}
            patientName={patient?.name || 'Unknown'}
            patientMR={patient?.patient_id || 'N/A'}
            doctorName={doctorName}
            onBackToQueue={onBackToQueue}
        >
            {/* Patient Info Bar */}
            <div className="patient-info-bar">
                <div className="info-item">
                    <span className="info-label">Patient</span>
                    <span className="info-value">{patient?.name}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">MR Number</span>
                    <span className="info-value">{patient?.patient_id}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Age</span>
                    <span className="info-value">{patient?.age} yrs</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Gender</span>
                    <span className="info-value">{patient?.gender || 'N/A'}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Glaucoma Type</span>
                    <span className="info-value highlight">{patient?.glaucoma_type || 'N/A'}</span>
                </div>
            </div>

            {/* Section Content */}
            {renderContent()}
            
            {/* First Visit Popup - Calculate Target IOP */}
            {showFirstVisitPopup && !firstVisitDismissed && (
                <div className="popup-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}>
                    <div className="popup-content" style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: '#1a7a7c' }}>🎯 First Visit - Calculate Target IOP</h3>
                            <button 
                                onClick={() => {
                                    setShowFirstVisitPopup(false);
                                    setFirstVisitDismissed(true);
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#666'
                                }}
                            >×</button>
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <p>
                                <strong>Welcome!</strong> This appears to be the patient's first visit.
                            </p>
                            <p>
                                Please calculate <strong>baseline IOP</strong> and <strong>target IOP</strong> to establish treatment goals.
                            </p>
                            <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
                                <li>Go to <strong>"Complaints"</strong> section to calculate baseline IOP</li>
                                <li>Then navigate to <strong>"Special Workflow" → "Target IOP"</strong> to calculate the target IOP</li>
                            </ol>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => {
                                    setShowFirstVisitPopup(false);
                                    setFirstVisitDismissed(true);
                                }}
                                style={{
                                    padding: '10px 20px',
                                    background: '#e5e7eb',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Later
                            </button>
                            <button 
                                onClick={() => {
                                    setShowFirstVisitPopup(false);
                                    setFirstVisitDismissed(true);
                                    setActiveSection('Complaints');
                                }}
                                style={{
                                    padding: '10px 20px',
                                    background: '#1a7a7c',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Calculate Target IOP Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
