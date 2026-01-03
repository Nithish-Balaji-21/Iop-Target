import React, { useState, useEffect } from 'react';
import './Diagnosis.css';

const API_BASE = 'http://localhost:8000';

export default function Diagnosis({ patientId, onDataChange }) {
    const [diagnoses, setDiagnoses] = useState([]);
    const [newDiagnosis, setNewDiagnosis] = useState({ eye: 'RE', condition: '', stage: '', notes: '' });
    const [isEditing, setIsEditing] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savedAt, setSavedAt] = useState(null);

    // Glaucoma diagnosis options - maps to ocular modifiers
    const glaucomaTypes = [
        { value: 'POAG', label: 'Primary Open-Angle Glaucoma (POAG)', modifiers: [] },
        { value: 'PXFG', label: 'Pseudoexfoliation Glaucoma (PXFG)', modifiers: ['pseudoexfoliation'] },
        { value: 'PG', label: 'Pigmentary Glaucoma (PG)', modifiers: ['pigment_dispersion'] },
        { value: 'NTG', label: 'Normal Tension Glaucoma (NTG)', modifiers: [] },
        { value: 'PACG', label: 'Primary Angle-Closure Glaucoma (PACG)', modifiers: [] },
        { value: 'ANGLE_RECESSION', label: 'Angle Recession Glaucoma', modifiers: ['angle_recession'] },
        { value: 'STEROID', label: 'Steroid-Induced Glaucoma', modifiers: ['steroid_responder'] },
        { value: 'JUVENILE', label: 'Juvenile Glaucoma', modifiers: [] },
        { value: 'SECONDARY', label: 'Secondary Glaucoma', modifiers: [] },
        { value: 'OHT', label: 'Ocular Hypertension (OHT)', modifiers: [] },
        { value: 'SUSPECT', label: 'Glaucoma Suspect', modifiers: [] }
    ];

    // Glaucoma stages - affects upper cap in target IOP
    const glaucomaStages = [
        { value: 'EARLY', label: 'Early Stage (Cap ≤18 mmHg)', cap: 18 },
        { value: 'MODERATE', label: 'Moderate Stage (Cap ≤16 mmHg)', cap: 16 },
        { value: 'ADVANCED', label: 'Advanced Stage (Cap ≤14 mmHg)', cap: 14 },
        { value: 'END_STAGE', label: 'End Stage (Cap ≤12 mmHg)', cap: 12 }
    ];

    useEffect(() => {
        if (patientId) {
            loadData();
        }
    }, [patientId]);

    const loadData = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/diagnosis`);
            const result = await response.json();

            if (result.exists && result.data) {
                setDiagnoses(result.data.diagnoses || []);
                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(result.updated_at || result.created_at);
            }
        } catch (error) {
            console.error('Error loading diagnosis data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/diagnosis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { diagnoses },
                    created_by: 'Dr. User'
                })
            });

            if (response.ok) {
                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(new Date().toISOString());
                
                if (onDataChange) {
                    onDataChange('diagnosis', { diagnoses });
                }
            }
        } catch (error) {
            console.error('Error saving diagnosis:', error);
            alert('Error saving data. Please try again.');
        }
    };

    const addDiagnosis = () => {
        if (newDiagnosis.condition) {
            const glaucomaType = glaucomaTypes.find(g => g.value === newDiagnosis.condition);
            const diagEntry = {
                ...newDiagnosis,
                label: glaucomaType?.label || newDiagnosis.condition,
                modifiers: glaucomaType?.modifiers || []
            };
            setDiagnoses(prev => [...prev, diagEntry]);
            setNewDiagnosis({ eye: 'RE', condition: '', stage: '', notes: '' });
        }
    };

    const removeDiagnosis = (index) => {
        setDiagnoses(prev => prev.filter((_, i) => i !== index));
    };

    const handleEdit = () => setIsEditing(true);

    const getStageLabel = (stage) => {
        const s = glaucomaStages.find(gs => gs.value === stage);
        return s ? s.label : stage;
    };

    if (loading) {
        return <div className="emr-diagnosis-container"><div className="loading">Loading...</div></div>;
    }

    return (
        <div className="emr-diagnosis-container">
            <div className="emr-section-header">
                <h3>🏥 Diagnosis</h3>
                <span className="emr-meta">
                    {savedAt ? `Last saved: ${new Date(savedAt).toLocaleString()}` : ''}
                </span>
                {isSaved && !isEditing && (
                    <button className="btn-edit" onClick={handleEdit}>Edit</button>
                )}
            </div>

            <div className="emr-section-content">
                <p className="risk-info">
                    <span className="info-icon">ℹ️</span>
                    Diagnosis type affects <strong>Domain E: Ocular Modifiers</strong> and glaucoma stage determines the <strong>Target IOP Upper Cap</strong>.
                </p>

                {isEditing ? (
                    <>
                        {/* Existing Diagnoses */}
                        <div className="diagnoses-list">
                            {diagnoses.map((diag, index) => (
                                <div key={index} className="diagnosis-entry">
                                    <div className="diag-header">
                                        <span className={`eye-badge ${diag.eye.toLowerCase()}`}>{diag.eye}</span>
                                        <span className="diag-name">{diag.label || diag.condition}</span>
                                        {diag.stage && <span className="stage-badge">{getStageLabel(diag.stage)}</span>}
                                        <button className="btn-remove" onClick={() => removeDiagnosis(index)}>×</button>
                                    </div>
                                    {diag.modifiers && diag.modifiers.length > 0 && (
                                        <div className="diag-modifiers">
                                            <span className="modifier-label">Risk Modifiers:</span>
                                            {diag.modifiers.map(m => (
                                                <span key={m} className="modifier-badge">{m.replace('_', ' ')}</span>
                                            ))}
                                        </div>
                                    )}
                                    {diag.notes && <div className="diag-notes">{diag.notes}</div>}
                                </div>
                            ))}
                        </div>

                        {/* Add New Diagnosis Form */}
                        <div className="add-diagnosis-form">
                            <h4>Add Diagnosis</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Eye</label>
                                    <select 
                                        value={newDiagnosis.eye} 
                                        onChange={(e) => setNewDiagnosis(prev => ({ ...prev, eye: e.target.value }))}
                                    >
                                        <option value="RE">Right Eye (RE/OD)</option>
                                        <option value="LE">Left Eye (LE/OS)</option>
                                        <option value="BE">Both Eyes (BE/OU)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>
                                        Glaucoma Type
                                        <span className="risk-badge small">Domain E</span>
                                    </label>
                                    <select 
                                        value={newDiagnosis.condition} 
                                        onChange={(e) => setNewDiagnosis(prev => ({ ...prev, condition: e.target.value }))}
                                    >
                                        <option value="">Select Diagnosis</option>
                                        {glaucomaTypes.map(g => (
                                            <option key={g.value} value={g.value}>
                                                {g.label} {g.modifiers.length > 0 ? '★' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>
                                        Glaucoma Stage
                                        <span className="risk-badge small">Cap</span>
                                    </label>
                                    <select 
                                        value={newDiagnosis.stage} 
                                        onChange={(e) => setNewDiagnosis(prev => ({ ...prev, stage: e.target.value }))}
                                    >
                                        <option value="">Select Stage</option>
                                        {glaucomaStages.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group full-width">
                                    <label>Notes</label>
                                    <input 
                                        type="text" 
                                        placeholder="Additional notes about diagnosis..."
                                        value={newDiagnosis.notes}
                                        onChange={(e) => setNewDiagnosis(prev => ({ ...prev, notes: e.target.value }))}
                                    />
                                </div>
                                <button className="btn-add" onClick={addDiagnosis}>Add Diagnosis</button>
                            </div>
                        </div>

                        <div className="action-row">
                            <button className="btn-save" onClick={handleSave}>💾 Save Diagnosis</button>
                            {isSaved && <button className="btn-cancel" onClick={() => setIsEditing(false)}>Cancel</button>}
                        </div>
                    </>
                ) : (
                    <div className="saved-data-display">
                        {diagnoses.length > 0 ? (
                            <div className="diagnoses-summary">
                                {diagnoses.map((diag, idx) => (
                                    <div key={idx} className="diagnosis-display">
                                        <span className={`eye-badge ${diag.eye.toLowerCase()}`}>{diag.eye}</span>
                                        <strong>{diag.label || diag.condition}</strong>
                                        {diag.stage && <span className="stage-info"> - {getStageLabel(diag.stage)}</span>}
                                        {diag.modifiers && diag.modifiers.length > 0 && (
                                            <span className="modifiers-info">
                                                (Modifiers: {diag.modifiers.join(', ')})
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-data">No diagnoses recorded</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
