import React, { useState, useEffect } from 'react';
import './VisualField.css';

const API_BASE = 'http://localhost:8000';

/**
 * Visual Field / HFA Component
 * Captures Mean Deviation and Central Field involvement for TRBS Domain D
 */
export default function VisualField({ patientId, onDataChange }) {
    const [vfData, setVfData] = useState({
        // Right Eye
        re: {
            testDate: '',
            meanDeviation: '',
            mdCategory: '0_to_minus_6',  // For TRBS
            psd: '',
            vfi: '',
            centralInvolvement: 'no',  // For TRBS
            reliability: 'reliable',
            testType: 'HFA 24-2',
            notes: ''
        },
        // Left Eye
        le: {
            testDate: '',
            meanDeviation: '',
            mdCategory: '0_to_minus_6',
            psd: '',
            vfi: '',
            centralInvolvement: 'no',
            reliability: 'reliable',
            testType: 'HFA 24-2',
            notes: ''
        }
    });

    const [isEditing, setIsEditing] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savedAt, setSavedAt] = useState(null);

    // MD Categories for TRBS Domain D
    const mdCategories = [
        { value: '0_to_minus_6', label: 'Normal/Early (0 to -6 dB)', points: 0 },
        { value: 'minus_6_to_minus_12', label: 'Moderate (-6 to -12 dB)', points: 2 },
        { value: 'less_than_minus_12', label: 'Advanced (< -12 dB)', points: 3 },
        { value: 'hfa_unreliable', label: 'HFA Unreliable', points: 2 },
        { value: 'hfa_not_possible', label: 'HFA Not Possible', points: 3 }
    ];

    const testTypes = ['HFA 24-2', 'HFA 10-2', 'HFA 30-2', 'Octopus', 'FDT', 'Other'];
    const reliabilityOptions = ['reliable', 'borderline', 'unreliable'];

    useEffect(() => {
        if (patientId) {
            loadData();
        }
    }, [patientId]);

    // Auto-categorize MD when value changes
    const categorizeMD = (mdValue) => {
        if (!mdValue || mdValue === '') return '0_to_minus_6';
        
        const md = parseFloat(mdValue);
        if (isNaN(md)) return '0_to_minus_6';
        
        if (md >= -6) return '0_to_minus_6';
        if (md >= -12) return 'minus_6_to_minus_12';
        return 'less_than_minus_12';
    };

    const loadData = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/visualfield`);
            const result = await response.json();

            if (result.exists && result.data) {
                setVfData(prev => ({
                    ...prev,
                    ...result.data.vfData
                }));
                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(result.updated_at || result.created_at);
            }
        } catch (error) {
            console.error('Error loading visual field data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/visualfield`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { vfData },
                    created_by: 'Dr. User'
                })
            });

            if (response.ok) {
                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(new Date().toISOString());
                
                if (onDataChange) {
                    onDataChange('visualfield', { vfData });
                }
            }
        } catch (error) {
            console.error('Error saving visual field data:', error);
            alert('Error saving data. Please try again.');
        }
    };

    const handleChange = (eye, field, value) => {
        setVfData(prev => {
            const updated = {
                ...prev,
                [eye]: { ...prev[eye], [field]: value }
            };
            
            // Auto-categorize MD
            if (field === 'meanDeviation') {
                updated[eye].mdCategory = categorizeMD(value);
            }
            
            // If reliability is unreliable, update category
            if (field === 'reliability' && value === 'unreliable') {
                updated[eye].mdCategory = 'hfa_unreliable';
            }
            
            return updated;
        });
    };

    const handleEdit = () => setIsEditing(true);

    const getMDCategoryLabel = (category) => {
        const cat = mdCategories.find(c => c.value === category);
        return cat ? `${cat.label} (${cat.points} pts)` : category;
    };

    if (loading) {
        return <div className="emr-vf-container"><div className="loading">Loading...</div></div>;
    }

    return (
        <div className="emr-vf-container">
            <div className="emr-section-header">
                <h3>📊 Visual Field (HFA)</h3>
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
                    Visual Field findings contribute to <strong>Domain D: Functional/Visual Field Changes</strong> in Target IOP calculation.
                </p>

                {isEditing ? (
                    <>
                        <div className="vf-grid">
                            {/* Right Eye */}
                            <div className="vf-eye-section">
                                <h4>Right Eye (OD)</h4>
                                
                                <div className="form-group">
                                    <label>Test Type</label>
                                    <select value={vfData.re.testType} onChange={(e) => handleChange('re', 'testType', e.target.value)}>
                                        {testTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Test Date</label>
                                    <input type="date" value={vfData.re.testDate} onChange={(e) => handleChange('re', 'testDate', e.target.value)} />
                                </div>

                                <div className="form-group highlight">
                                    <label>
                                        Mean Deviation (MD) 
                                        <span className="risk-badge">Domain D</span>
                                    </label>
                                    <div className="input-with-unit">
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            placeholder="-3.5" 
                                            value={vfData.re.meanDeviation} 
                                            onChange={(e) => handleChange('re', 'meanDeviation', e.target.value)} 
                                        />
                                        <span className="unit">dB</span>
                                    </div>
                                    <div className="auto-category">
                                        Auto-categorized: <strong>{getMDCategoryLabel(vfData.re.mdCategory)}</strong>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Pattern Standard Deviation (PSD)</label>
                                    <div className="input-with-unit">
                                        <input type="number" step="0.1" placeholder="2.5" value={vfData.re.psd} onChange={(e) => handleChange('re', 'psd', e.target.value)} />
                                        <span className="unit">dB</span>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Visual Field Index (VFI)</label>
                                    <div className="input-with-unit">
                                        <input type="number" placeholder="95" value={vfData.re.vfi} onChange={(e) => handleChange('re', 'vfi', e.target.value)} />
                                        <span className="unit">%</span>
                                    </div>
                                </div>

                                <div className="form-group highlight">
                                    <label>
                                        Central 10° Involvement
                                        <span className="risk-badge">Domain D (+2 pts)</span>
                                    </label>
                                    <select value={vfData.re.centralInvolvement} onChange={(e) => handleChange('re', 'centralInvolvement', e.target.value)}>
                                        <option value="no">No (0 pts)</option>
                                        <option value="yes">Yes (2 pts)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Reliability</label>
                                    <select value={vfData.re.reliability} onChange={(e) => handleChange('re', 'reliability', e.target.value)}>
                                        {reliabilityOptions.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea placeholder="Additional findings..." value={vfData.re.notes} onChange={(e) => handleChange('re', 'notes', e.target.value)} />
                                </div>
                            </div>

                            {/* Left Eye */}
                            <div className="vf-eye-section">
                                <h4>Left Eye (OS)</h4>
                                
                                <div className="form-group">
                                    <label>Test Type</label>
                                    <select value={vfData.le.testType} onChange={(e) => handleChange('le', 'testType', e.target.value)}>
                                        {testTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Test Date</label>
                                    <input type="date" value={vfData.le.testDate} onChange={(e) => handleChange('le', 'testDate', e.target.value)} />
                                </div>

                                <div className="form-group highlight">
                                    <label>
                                        Mean Deviation (MD) 
                                        <span className="risk-badge">Domain D</span>
                                    </label>
                                    <div className="input-with-unit">
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            placeholder="-2.8" 
                                            value={vfData.le.meanDeviation} 
                                            onChange={(e) => handleChange('le', 'meanDeviation', e.target.value)} 
                                        />
                                        <span className="unit">dB</span>
                                    </div>
                                    <div className="auto-category">
                                        Auto-categorized: <strong>{getMDCategoryLabel(vfData.le.mdCategory)}</strong>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Pattern Standard Deviation (PSD)</label>
                                    <div className="input-with-unit">
                                        <input type="number" step="0.1" placeholder="2.2" value={vfData.le.psd} onChange={(e) => handleChange('le', 'psd', e.target.value)} />
                                        <span className="unit">dB</span>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Visual Field Index (VFI)</label>
                                    <div className="input-with-unit">
                                        <input type="number" placeholder="97" value={vfData.le.vfi} onChange={(e) => handleChange('le', 'vfi', e.target.value)} />
                                        <span className="unit">%</span>
                                    </div>
                                </div>

                                <div className="form-group highlight">
                                    <label>
                                        Central 10° Involvement
                                        <span className="risk-badge">Domain D (+2 pts)</span>
                                    </label>
                                    <select value={vfData.le.centralInvolvement} onChange={(e) => handleChange('le', 'centralInvolvement', e.target.value)}>
                                        <option value="no">No (0 pts)</option>
                                        <option value="yes">Yes (2 pts)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Reliability</label>
                                    <select value={vfData.le.reliability} onChange={(e) => handleChange('le', 'reliability', e.target.value)}>
                                        {reliabilityOptions.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea placeholder="Additional findings..." value={vfData.le.notes} onChange={(e) => handleChange('le', 'notes', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="action-row">
                            <button className="btn-save" onClick={handleSave}>💾 Save Visual Field Data</button>
                            {isSaved && <button className="btn-cancel" onClick={() => setIsEditing(false)}>Cancel</button>}
                        </div>
                    </>
                ) : (
                    <div className="saved-data-display">
                        <div className="vf-summary-grid">
                            <div className="vf-summary-card">
                                <h4>Right Eye (OD)</h4>
                                <div className="summary-item"><span>Test:</span> {vfData.re.testType}</div>
                                <div className="summary-item highlight"><span>MD:</span> {vfData.re.meanDeviation || '-'} dB</div>
                                <div className="summary-item"><span>Category:</span> {getMDCategoryLabel(vfData.re.mdCategory)}</div>
                                <div className="summary-item highlight"><span>Central 10°:</span> {vfData.re.centralInvolvement === 'yes' ? 'Involved (+2 pts)' : 'Not Involved'}</div>
                                <div className="summary-item"><span>VFI:</span> {vfData.re.vfi || '-'}%</div>
                            </div>
                            <div className="vf-summary-card">
                                <h4>Left Eye (OS)</h4>
                                <div className="summary-item"><span>Test:</span> {vfData.le.testType}</div>
                                <div className="summary-item highlight"><span>MD:</span> {vfData.le.meanDeviation || '-'} dB</div>
                                <div className="summary-item"><span>Category:</span> {getMDCategoryLabel(vfData.le.mdCategory)}</div>
                                <div className="summary-item highlight"><span>Central 10°:</span> {vfData.le.centralInvolvement === 'yes' ? 'Involved (+2 pts)' : 'Not Involved'}</div>
                                <div className="summary-item"><span>VFI:</span> {vfData.le.vfi || '-'}%</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
