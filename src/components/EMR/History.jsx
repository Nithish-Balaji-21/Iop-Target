import React, { useState, useEffect } from 'react';
import './History.css';

const API_BASE = 'http://localhost:8000';

export default function History({ patientId, onDataChange }) {
    const [activeTab, setActiveTab] = useState('systemic');
    const [conditions, setConditions] = useState([]);
    const [showAddForm, setShowAddForm] = useState(true);
    const [newCondition, setNewCondition] = useState({
        name: '', duration: '', treatment: '', medication: '', dosage: ''
    });
    const [isEditing, setIsEditing] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savedAt, setSavedAt] = useState(null);

    // Toggle-based systemic conditions (matching reference image)
    const [systemicToggles, setSystemicToggles] = useState({
        asthma: false,
        cardiac: false,
        diabetes: false,
        epilepsy: false,
        malignancy: false,
        hyperlipidemia: false,
        hypertension: false,
        nonHealing: false,
        renal: false,
        stroke: false,
        tb: false,
        thyroid: false,
        otherAllergies: false,
        drugAllergies: false,
        nonOcularSurgery: false,
        // Glaucoma-specific risk factors
        familyGlaucoma: false,
        migraine: false,
        raynauds: false,
        sleepApnea: false
    });

    const [remarks, setRemarks] = useState('');
    const [otherConditions, setOtherConditions] = useState('');

    // Ocular History state
    const [ocularHistory, setOcularHistory] = useState({
        rows: [],
        row1: { year: '2023', reDescription: '', leDescription: '' },
        row2: { year: '2023', reDescription: '', leDescription: '' }
    });

    // AGM (Anti-Glaucoma Medication) state - affects baseline IOP logic
    const [agmHistory, setAgmHistory] = useState({
        isOnAGM: false,
        agmStartDate: '',
        currentIOP: { od: '', os: '' },        // Current IOP (on treatment)
        calculatedBaseline: { od: '', os: '' }, // Calculated untreated baseline
        currentMedications: []
    });

    // Calculate AGM adjustment based on number of medications
    const getAGMAdjustment = (numMedications) => {
        if (numMedications === 0) return 0;
        if (numMedications === 1) return 5;
        if (numMedications === 2) return 8;
        return 10; // 3 or more
    };

    // Calculate untreated baseline from current IOP + AGM adjustment
    const calculateUntreatedBaseline = (currentIOP, numMedications) => {
        if (!currentIOP || currentIOP === '') return '';
        const adjustment = getAGMAdjustment(numMedications);
        return parseFloat(currentIOP) + adjustment;
    };

    // Update calculated baseline when current IOP or medications change
    useEffect(() => {
        if (agmHistory.isOnAGM) {
            const numMeds = agmHistory.currentMedications.length;
            const newBaseline = {
                od: calculateUntreatedBaseline(agmHistory.currentIOP.od, numMeds),
                os: calculateUntreatedBaseline(agmHistory.currentIOP.os, numMeds)
            };
            setAgmHistory(prev => ({
                ...prev,
                calculatedBaseline: newBaseline
            }));
        }
    }, [agmHistory.currentIOP, agmHistory.currentMedications, agmHistory.isOnAGM]);
    const [newOcularEntry, setNewOcularEntry] = useState({
        eye: 'RE',
        year: '',
        description: '',
        hospital: ''
    });
    const [showOcularForm, setShowOcularForm] = useState(false);

    // Add new ocular row
    const addOcularRow = (afterIndex) => {
        const newRow = { year: new Date().getFullYear().toString(), reDescription: '', leDescription: '' };
        setOcularHistory(prev => {
            const newRows = [...(prev.rows || [])];
            newRows.splice(afterIndex + 1, 0, newRow);
            return { ...prev, rows: newRows };
        });
    };

    // Update ocular row
    const updateOcularRow = (index, field, value) => {
        setOcularHistory(prev => {
            const newRows = [...(prev.rows || [])];
            if (newRows[index]) {
                newRows[index] = { ...newRows[index], [field]: value };
            }
            return { ...prev, rows: newRows };
        });
    };

    // Systemic conditions that map to TRBS risk factors
    const systemicConditions = [
        { value: 'DIABETES', label: 'Diabetes', riskFactor: 'diabetes' },
        { value: 'HYPERTENSION', label: 'Hypertension', riskFactor: 'hypertension' },
        { value: 'HYPOTENSION', label: 'Systemic Hypotension', riskFactor: 'systemic_hypotension' },
        { value: 'CARDIOVASCULAR', label: 'Cardiovascular Disease', riskFactor: 'cardiovascular_disease' },
        { value: 'MIGRAINE', label: 'Migraine', riskFactor: 'migraine' },
        { value: 'RAYNAUD', label: "Raynaud's Phenomenon", riskFactor: 'raynaud' },
        { value: 'SLEEP_APNEA', label: 'Sleep Apnea', riskFactor: 'sleep_apnea' },
        { value: 'ASTHMA', label: 'Asthma', riskFactor: null },
        { value: 'THYROID', label: 'Thyroid Disorder', riskFactor: null },
        { value: 'CARDIAC', label: 'Cardiac Condition', riskFactor: 'cardiovascular_disease' },
        { value: 'FAMILY_GLAUCOMA', label: 'Family History of Glaucoma', riskFactor: 'family_history' }
    ];

    // Toggle systemic condition
    const toggleSystemic = (key) => {
        setSystemicToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Check if all conditions are negative
    const isNilSystemicHistory = () => {
        return !Object.values(systemicToggles).some(v => v);
    };

    // Add ocular history entry
    const addOcularEntry = () => {
        if (newOcularEntry.description) {
            const entry = { ...newOcularEntry };
            if (newOcularEntry.eye === 'RE') {
                setOcularHistory(prev => ({
                    ...prev,
                    rightEye: [...prev.rightEye, entry]
                }));
            } else {
                setOcularHistory(prev => ({
                    ...prev,
                    leftEye: [...prev.leftEye, entry]
                }));
            }
            setNewOcularEntry({ eye: 'RE', year: '', description: '', hospital: '' });
            setShowOcularForm(false);
        }
    };

    // Remove ocular history entry
    const removeOcularEntry = (eye, index) => {
        if (eye === 'RE') {
            setOcularHistory(prev => ({
                ...prev,
                rightEye: prev.rightEye.filter((_, i) => i !== index)
            }));
        } else {
            setOcularHistory(prev => ({
                ...prev,
                leftEye: prev.leftEye.filter((_, i) => i !== index)
            }));
        }
    };

    useEffect(() => {
        if (patientId) {
            loadData();
        }
    }, [patientId]);

    const loadData = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/history`);
            const result = await response.json();

            if (result.exists && result.data) {
                setConditions(result.data.conditions || []);
                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(result.updated_at || result.created_at);
            }
        } catch (error) {
            console.error('Error loading history data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { conditions },
                    created_by: 'Dr. User'
                })
            });

            if (response.ok) {
                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(new Date().toISOString());
                
                // Notify parent of data change for risk factor extraction
                if (onDataChange) {
                    onDataChange('history', { conditions });
                }
            }
        } catch (error) {
            console.error('Error saving history data:', error);
            alert('Error saving data. Please try again.');
        }
    };

    const handleNewConditionChange = (field, value) => {
        setNewCondition(prev => ({ ...prev, [field]: value }));
    };

    const addCondition = () => {
        if (newCondition.name) {
            setConditions(prev => [...prev, { ...newCondition }]);
            setNewCondition({ name: '', duration: '', treatment: '', medication: '', dosage: '' });
            setShowAddForm(false);
        }
    };

    const removeCondition = (index) => {
        setConditions(prev => prev.filter((_, i) => i !== index));
    };

    const handleEdit = () => setIsEditing(true);
    
    const handleClear = () => {
        setSystemicToggles({
            asthma: false,
            cardiac: false,
            diabetes: false,
            epilepsy: false,
            malignancy: false,
            hyperlipidemia: false,
            hypertension: false,
            nonHealing: false,
            renal: false,
            stroke: false,
            tb: false,
            thyroid: false,
            otherAllergies: false,
            drugAllergies: false,
            nonOcularSurgery: false,
            familyGlaucoma: false,
            migraine: false,
            raynauds: false,
            sleepApnea: false
        });
        setRemarks('');
        setOtherConditions('');
    };

    const handleUpdate = async () => {
        // Convert toggles to conditions array for saving
        const activeConditions = Object.entries(systemicToggles)
            .filter(([_, value]) => value)
            .map(([key, _]) => ({ name: key, active: true }));
        
        // Extract risk factors for Target IOP calculation
        const riskFactors = {
            family_history: systemicToggles.familyGlaucoma ? 'present' : 'absent',
            systemic_factors: []
        };
        
        // Map systemic conditions to risk factors
        if (systemicToggles.diabetes) riskFactors.systemic_factors.push('diabetes_mellitus');
        if (systemicToggles.migraine) riskFactors.systemic_factors.push('migraine_vasospasm');
        if (systemicToggles.raynauds) riskFactors.systemic_factors.push('raynauds');
        if (systemicToggles.sleepApnea) riskFactors.systemic_factors.push('sleep_apnea');
        if (systemicToggles.hypertension || systemicToggles.cardiac) riskFactors.systemic_factors.push('low_ocular_perfusion');

        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { 
                        conditions: activeConditions,
                        systemicToggles,
                        ocularHistory,
                        remarks,
                        otherConditions,
                        riskFactors
                    },
                    created_by: 'Dr. User'
                })
            });

            if (response.ok) {
                setIsSaved(true);
                setSavedAt(new Date().toISOString());
                
                if (onDataChange) {
                    onDataChange('history', { 
                        conditions: activeConditions, 
                        systemicToggles, 
                        ocularHistory, 
                        riskFactors,
                        agmHistory  // Include AGM data for baseline IOP logic
                    });
                }
                alert('History saved successfully!');
            }
        } catch (error) {
            console.error('Error saving history data:', error);
            alert('Error saving data. Please try again.');
        }
    };

    if (loading) {
        return <div className="emr-history-container"><div className="loading">Loading...</div></div>;
    }

    // Toggle Button Component
    const ToggleButton = ({ label, value, onChange, required = false }) => (
        <div className="toggle-row">
            <span className="toggle-label">{label}{required && ' *'}</span>
            <div className="toggle-buttons">
                <button 
                    className={`toggle-btn ${!value ? 'active no' : ''}`}
                    onClick={() => onChange(false)}
                >
                    No
                </button>
                <button 
                    className={`toggle-btn ${value ? 'active yes' : ''}`}
                    onClick={() => onChange(true)}
                >
                    Yes
                </button>
            </div>
        </div>
    );

    return (
        <div className="emr-history-container">
            {/* Tab Navigation */}
            <div className="history-tabs">
                <button 
                    className={`history-tab ${activeTab === 'systemic' ? 'active' : ''}`}
                    onClick={() => setActiveTab('systemic')}
                >
                    Systemic History
                </button>
                <button 
                    className={`history-tab ${activeTab === 'ocular' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ocular')}
                >
                    Ocular History
                </button>
            </div>

            {/* Systemic History Tab */}
            {activeTab === 'systemic' && (
                <div className="systemic-history-content">
                    <div className="risk-info">
                        <span className="info-icon">ℹ️</span>
                        Systemic conditions are used to calculate <strong>Domain F: Systemic Risk Modifiers</strong> in Target IOP calculation.
                    </div>

                    {/* Systemic History Status */}
                    <div className="systemic-status-bar">
                        <span className={`status-badge ${isNilSystemicHistory() ? 'nil' : 'has-history'}`}>
                            {isNilSystemicHistory() ? 'Nil Systemic History' : 'Systemic History Present'}
                        </span>
                    </div>

                    {/* Toggle List */}
                    <div className="toggle-list">
                        <ToggleButton 
                            label="Asthma" 
                            value={systemicToggles.asthma} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, asthma: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Cardiac" 
                            value={systemicToggles.cardiac} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, cardiac: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Diabetes" 
                            value={systemicToggles.diabetes} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, diabetes: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Epilepsy/Seizures" 
                            value={systemicToggles.epilepsy} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, epilepsy: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="History of Malignancy" 
                            value={systemicToggles.malignancy} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, malignancy: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Hyperlipidemia" 
                            value={systemicToggles.hyperlipidemia} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, hyperlipidemia: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Hypertension" 
                            value={systemicToggles.hypertension} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, hypertension: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Non Healing (ulcer in hand/foot)" 
                            value={systemicToggles.nonHealing} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, nonHealing: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Renal Disease" 
                            value={systemicToggles.renal} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, renal: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Stroke/Neuro" 
                            value={systemicToggles.stroke} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, stroke: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="TB" 
                            value={systemicToggles.tb} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, tb: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Thyroid Status" 
                            value={systemicToggles.thyroid} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, thyroid: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Other Allergies" 
                            value={systemicToggles.otherAllergies} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, otherAllergies: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Drug Allergies" 
                            value={systemicToggles.drugAllergies} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, drugAllergies: v}))}
                            required 
                        />
                        <ToggleButton 
                            label="Non-Ocular Sx" 
                            value={systemicToggles.nonOcularSurgery} 
                            onChange={(v) => setSystemicToggles(prev => ({...prev, nonOcularSurgery: v}))}
                            required 
                        />
                    </div>

                    {/* Glaucoma-Specific Risk Factors */}
                    <div className="risk-factors-section">
                        <h4 className="risk-factors-title">🎯 Glaucoma Risk Factors (for Target IOP)</h4>
                        <div className="risk-info-small">
                            These conditions will auto-populate in Target IOP Calculator
                        </div>
                        <div className="toggle-list risk-toggles">
                            <ToggleButton 
                                label="Family History of Glaucoma (1st Degree)" 
                                value={systemicToggles.familyGlaucoma} 
                                onChange={(v) => setSystemicToggles(prev => ({...prev, familyGlaucoma: v}))}
                                required 
                            />
                            <ToggleButton 
                                label="Migraine / Vasospasm" 
                                value={systemicToggles.migraine} 
                                onChange={(v) => setSystemicToggles(prev => ({...prev, migraine: v}))}
                                required 
                            />
                            <ToggleButton 
                                label="Raynaud's Phenomenon" 
                                value={systemicToggles.raynauds} 
                                onChange={(v) => setSystemicToggles(prev => ({...prev, raynauds: v}))}
                                required 
                            />
                            <ToggleButton 
                                label="Sleep Apnea" 
                                value={systemicToggles.sleepApnea} 
                                onChange={(v) => setSystemicToggles(prev => ({...prev, sleepApnea: v}))}
                                required 
                            />
                        </div>
                    </div>

                    {/* Others dropdown */}
                    <div className="others-row">
                        <span className="toggle-label">Others</span>
                        <select 
                            className="others-select"
                            value={otherConditions}
                            onChange={(e) => {
                                const value = e.target.value;
                                setOtherConditions(value);
                                // Auto-populate risk factor toggles based on selection
                                if (value === 'Migraine') {
                                    setSystemicToggles(prev => ({...prev, migraine: true}));
                                } else if (value === "Raynaud's Phenomenon") {
                                    setSystemicToggles(prev => ({...prev, raynauds: true}));
                                } else if (value === 'Sleep Apnea') {
                                    setSystemicToggles(prev => ({...prev, sleepApnea: true}));
                                } else if (value === 'Cardiovascular Disease') {
                                    setSystemicToggles(prev => ({...prev, cardiac: true}));
                                } else if (value === 'Systemic Hypotension') {
                                    setSystemicToggles(prev => ({...prev, hypertension: true}));
                                } else if (value === 'Family History of Glaucoma') {
                                    setSystemicToggles(prev => ({...prev, familyGlaucoma: true}));
                                }
                            }}
                        >
                            <option value="">Select Others</option>
                            <option value="Migraine">Migraine</option>
                            <option value="Raynaud's Phenomenon">Raynaud's Phenomenon</option>
                            <option value="Sleep Apnea">Sleep Apnea</option>
                            <option value="Cardiovascular Disease">Cardiovascular Disease</option>
                            <option value="Systemic Hypotension">Systemic Hypotension</option>
                            <option value="Family History of Glaucoma">Family History of Glaucoma</option>
                        </select>
                        {otherConditions && <span className="check-icon">✓</span>}
                    </div>

                    {/* Remarks */}
                    <div className="remarks-row">
                        <span className="toggle-label">Remarks</span>
                        <textarea 
                            className="remarks-input"
                            placeholder="Remarks (max 50 chars)"
                            maxLength={50}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="action-buttons">
                        <button className="btn-update" onClick={handleUpdate}>Update</button>
                        <button className="btn-clear" onClick={handleClear}>Clear</button>
                    </div>
                </div>
            )}

            {/* Ocular History Tab */}
            {activeTab === 'ocular' && (
                <div className="ocular-history-content">
                    {/* AGM (Anti-Glaucoma Medication) Section */}
                    <div className="agm-section">
                        <div className="agm-header">
                            <span className="agm-icon">💊</span>
                            <span className="agm-title">Anti-Glaucoma Medications (AGM)</span>
                        </div>
                        <div className="agm-info">
                            <span className="info-icon">ℹ️</span>
                            If patient is already on AGM, enter current IOP. System will <strong>calculate untreated baseline</strong> by adding: 1 AGM → +5mmHg | 2 AGM → +8mmHg | ≥3 AGM → +10mmHg
                        </div>
                        
                        <div className="agm-toggle-row">
                            <span className="agm-label">Is patient currently on AGM?</span>
                            <div className="toggle-buttons">
                                <button 
                                    className={`toggle-btn ${!agmHistory.isOnAGM ? 'active no' : ''}`}
                                    onClick={() => setAgmHistory(prev => ({ ...prev, isOnAGM: false }))}
                                >
                                    No
                                </button>
                                <button 
                                    className={`toggle-btn ${agmHistory.isOnAGM ? 'active yes' : ''}`}
                                    onClick={() => setAgmHistory(prev => ({ ...prev, isOnAGM: true }))}
                                >
                                    Yes
                                </button>
                            </div>
                        </div>

                        {agmHistory.isOnAGM && (
                            <div className="agm-details">
                                <div className="agm-row">
                                    <label>AGM Start Date (Approx):</label>
                                    <input
                                        type="text"
                                        className="agm-input"
                                        placeholder="e.g., Jan 2024"
                                        value={agmHistory.agmStartDate}
                                        onChange={(e) => setAgmHistory(prev => ({ ...prev, agmStartDate: e.target.value }))}
                                    />
                                </div>
                                <div className="agm-medications">
                                    <label>Current Medications ({agmHistory.currentMedications.length} selected):</label>
                                    <div className="medication-checkboxes">
                                        {['Timolol', 'Brimonidine', 'Dorzolamide', 'Latanoprost', 'Travoprost', 'Bimatoprost', 'Brinzolamide', 'Pilocarpine'].map(med => (
                                            <label key={med} className="med-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={agmHistory.currentMedications.includes(med)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setAgmHistory(prev => ({
                                                                ...prev,
                                                                currentMedications: [...prev.currentMedications, med]
                                                            }));
                                                        } else {
                                                            setAgmHistory(prev => ({
                                                                ...prev,
                                                                currentMedications: prev.currentMedications.filter(m => m !== med)
                                                            }));
                                                        }
                                                    }}
                                                />
                                                {med}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Current IOP Input (on treatment) */}
                                <div className="current-iop-section">
                                    <label>📍 Current IOP (on treatment):</label>
                                    <div className="current-iop-inputs">
                                        <div className="iop-input-group">
                                            <span>OD:</span>
                                            <input
                                                type="number"
                                                placeholder="e.g., 18"
                                                value={agmHistory.currentIOP.od}
                                                onChange={(e) => setAgmHistory(prev => ({
                                                    ...prev,
                                                    currentIOP: { ...prev.currentIOP, od: e.target.value }
                                                }))}
                                            />
                                            <span className="unit">mmHg</span>
                                        </div>
                                        <div className="iop-input-group">
                                            <span>OS:</span>
                                            <input
                                                type="number"
                                                placeholder="e.g., 18"
                                                value={agmHistory.currentIOP.os}
                                                onChange={(e) => setAgmHistory(prev => ({
                                                    ...prev,
                                                    currentIOP: { ...prev.currentIOP, os: e.target.value }
                                                }))}
                                            />
                                            <span className="unit">mmHg</span>
                                        </div>
                                    </div>
                                </div>

                                {/* AGM Adjustment Formula */}
                                <div className="agm-formula-box">
                                    <div className="formula-title">📊 Baseline IOP Calculation Formula:</div>
                                    <div className="formula-content">
                                        <div className="formula-row">
                                            <span className="formula-label">Number of AGMs:</span>
                                            <span className="formula-value">{agmHistory.currentMedications.length}</span>
                                        </div>
                                        <div className="formula-row">
                                            <span className="formula-label">Adjustment to add:</span>
                                            <span className="formula-value highlight">+{getAGMAdjustment(agmHistory.currentMedications.length)} mmHg</span>
                                        </div>
                                        <div className="formula-rule">
                                            <small>1 AGM → +5 mmHg | 2 AGM → +8 mmHg | ≥3 AGM → +10 mmHg</small>
                                        </div>
                                    </div>
                                </div>

                                {/* Calculated Untreated Baseline */}
                                <div className="calculated-baseline">
                                    <div className="baseline-header">
                                        <span className="baseline-icon">🎯</span>
                                        <span className="baseline-title">Calculated Untreated Baseline IOP</span>
                                    </div>
                                    <div className="baseline-values">
                                        <div className="baseline-eye">
                                            <span className="eye-label">OD (Right)</span>
                                            <span className="eye-value">
                                                {agmHistory.calculatedBaseline.od ? 
                                                    `${agmHistory.calculatedBaseline.od} mmHg` : 
                                                    '--'}
                                            </span>
                                            {agmHistory.currentIOP.od && (
                                                <span className="calculation-detail">
                                                    ({agmHistory.currentIOP.od} + {getAGMAdjustment(agmHistory.currentMedications.length)})
                                                </span>
                                            )}
                                        </div>
                                        <div className="baseline-eye">
                                            <span className="eye-label">OS (Left)</span>
                                            <span className="eye-value">
                                                {agmHistory.calculatedBaseline.os ? 
                                                    `${agmHistory.calculatedBaseline.os} mmHg` : 
                                                    '--'}
                                            </span>
                                            {agmHistory.currentIOP.os && (
                                                <span className="calculation-detail">
                                                    ({agmHistory.currentIOP.os} + {getAGMAdjustment(agmHistory.currentMedications.length)})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="baseline-note">
                                        ✓ This calculated baseline will be used for Target IOP calculation
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Ocular History Card */}
                    <div className="ocular-card">
                        <div className="ocular-card-header">
                            <span className="ocular-badge">Ocular History</span>
                        </div>
                        <div className="ocular-card-meta">
                            <span className="doctor-info">Dr. User @ {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString()}</span>
                        </div>

                        {/* Table Header */}
                        <div className="ocular-table-row header">
                            <div className="col-action"></div>
                            <div className="col-sp"></div>
                            <div className="col-year">Year</div>
                            <div className="col-re-desc">RE Description</div>
                            <div className="col-le-desc">LE Description</div>
                        </div>

                        {/* Ocular History Rows */}
                        {ocularHistory.rows && ocularHistory.rows.map((row, index) => (
                            <div key={index} className="ocular-table-row">
                                <div className="col-action">
                                    <button className="btn-add-row" onClick={() => addOcularRow(index)}>+</button>
                                </div>
                                <div className="col-sp">
                                    <span className="sp-badge">S/P</span>
                                </div>
                                <div className="col-year">
                                    <input
                                        type="text"
                                        className="year-input"
                                        value={row.year}
                                        onChange={(e) => updateOcularRow(index, 'year', e.target.value)}
                                        placeholder="2023"
                                    />
                                </div>
                                <div className="col-re-desc">
                                    <textarea
                                        className="desc-textarea"
                                        value={row.reDescription}
                                        onChange={(e) => updateOcularRow(index, 'reDescription', e.target.value)}
                                        placeholder="Enter RE description"
                                    />
                                </div>
                                <div className="col-le-desc">
                                    <textarea
                                        className="desc-textarea"
                                        value={row.leDescription}
                                        onChange={(e) => updateOcularRow(index, 'leDescription', e.target.value)}
                                        placeholder="Enter LE description"
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Default rows if none exist */}
                        {(!ocularHistory.rows || ocularHistory.rows.length === 0) && (
                            <>
                                <div className="ocular-table-row">
                                    <div className="col-action">
                                        <button className="btn-add-row" onClick={() => addOcularRow(0)}>+</button>
                                    </div>
                                    <div className="col-sp">
                                        <span className="sp-badge">S/P</span>
                                    </div>
                                    <div className="col-year">
                                        <input
                                            type="text"
                                            className="year-input"
                                            value={ocularHistory.row1?.year || '2023'}
                                            onChange={(e) => setOcularHistory(prev => ({
                                                ...prev,
                                                row1: { ...prev.row1, year: e.target.value }
                                            }))}
                                            placeholder="2023"
                                        />
                                    </div>
                                    <div className="col-re-desc">
                                        <textarea
                                            className="desc-textarea"
                                            value={ocularHistory.row1?.reDescription || ''}
                                            onChange={(e) => setOcularHistory(prev => ({
                                                ...prev,
                                                row1: { ...prev.row1, reDescription: e.target.value }
                                            }))}
                                            placeholder="09 Dec 2023 : LE NPDS + PHACO done"
                                        />
                                    </div>
                                    <div className="col-le-desc">
                                        <textarea
                                            className="desc-textarea"
                                            value={ocularHistory.row1?.leDescription || ''}
                                            onChange={(e) => setOcularHistory(prev => ({
                                                ...prev,
                                                row1: { ...prev.row1, leDescription: e.target.value }
                                            }))}
                                            placeholder="Enter LE description"
                                        />
                                    </div>
                                </div>
                                <div className="ocular-table-row">
                                    <div className="col-action">
                                        <button className="btn-add-row" onClick={() => addOcularRow(1)}>+</button>
                                    </div>
                                    <div className="col-sp">
                                        <span className="sp-badge">S/P</span>
                                    </div>
                                    <div className="col-year">
                                        <input
                                            type="text"
                                            className="year-input"
                                            value={ocularHistory.row2?.year || '2023'}
                                            onChange={(e) => setOcularHistory(prev => ({
                                                ...prev,
                                                row2: { ...prev.row2, year: e.target.value }
                                            }))}
                                            placeholder="2023"
                                        />
                                    </div>
                                    <div className="col-re-desc">
                                        <textarea
                                            className="desc-textarea"
                                            value={ocularHistory.row2?.reDescription || ''}
                                            onChange={(e) => setOcularHistory(prev => ({
                                                ...prev,
                                                row2: { ...prev.row2, reDescription: e.target.value }
                                            }))}
                                            placeholder="09 Dec 2023 : LE NPDS + PHACO done"
                                        />
                                    </div>
                                    <div className="col-le-desc">
                                        <textarea
                                            className="desc-textarea"
                                            value={ocularHistory.row2?.leDescription || ''}
                                            onChange={(e) => setOcularHistory(prev => ({
                                                ...prev,
                                                row2: { ...prev.row2, leDescription: e.target.value }
                                            }))}
                                            placeholder="Enter LE description"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Action Buttons */}
                        <div className="ocular-actions">
                            <button className="btn-save-ocular" onClick={handleUpdate}>Save</button>
                            <button className="btn-cancel-ocular" onClick={handleClear}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

