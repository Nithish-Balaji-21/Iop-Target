import React, { useState, useEffect } from 'react';
import './FundusExam.css';

const API_BASE = 'http://localhost:8000';

export default function FundusExam({ patientId, onDataChange }) {
    const [examData, setExamData] = useState({
        media: { re: '', le: '' },
        discCdr: { re: '', le: '' },
        discNotch: { re: '', le: '' },
        discHemorrhage: { re: '', le: '' },  // Added for TRBS
        discPpa: { re: '', le: '' },
        rnflDefect: { re: '', le: '' },  // Added for TRBS
        vessels: { re: '', le: '' },
        backgroundRetina: { re: '', le: '' },
        maculaFovealReflex: { re: '', le: '' }
    });

    const [isEditing, setIsEditing] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savedAt, setSavedAt] = useState(null);

    // CDR options for dropdown (0.1 to 1.0)
    const cdrOptions = ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1.0'];
    
    // Notch options - simplified (Absent/Present)
    const notchOptions = [
        { value: '', label: 'Select Notch' },
        { value: 'Absent', label: 'Absent (0 points)' },
        { value: 'Present', label: 'Present (3 points)' }
    ];

    const hemorrhageOptions = [
        { value: '', label: 'Select' },
        { value: 'Absent', label: 'Absent (0 points)' },
        { value: 'Present', label: 'Present (1 point)' }
    ];

    useEffect(() => {
        if (patientId) {
            loadData();
        }
    }, [patientId]);

    const loadData = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/fundusexam`);
            const result = await response.json();

            if (result.exists && result.data) {
                setExamData(prev => ({
                    ...prev,
                    ...result.data.examData
                }));
                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(result.updated_at || result.created_at);
            }
        } catch (error) {
            console.error('Error loading fundus exam data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Map CDR value to TRBS format
    const mapCdrToTRBS = (cdrValue) => {
        if (!cdrValue) return '0.5_or_less';
        const cdr = parseFloat(cdrValue);
        if (cdr <= 0.5) return '0.5_or_less';
        if (cdr === 0.6) return '0.6';
        if (cdr === 0.7) return '0.7';
        if (cdr === 0.8) return '0.8';
        return '0.9_or_more';
    };

    // Map notch value to TRBS format
    const mapNotchToTRBS = (notchValue) => {
        if (!notchValue || notchValue === 'Absent' || notchValue === 'No Notch') return 'absent';
        return 'bipolar'; // Present = bipolar (3 points)
    };

    // Map hemorrhage value to TRBS format
    const mapHemorrhageToTRBS = (value) => {
        if (!value || value === 'Absent') return 'absent';
        return 'present';
    };

    const handleSave = async () => {
        try {
            // Save fundus exam data
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/fundusexam`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { examData },
                    created_by: 'Dr. User'
                })
            });

            if (response.ok) {
                // Also update risk factors for Target IOP Calculator
                await fetch(`${API_BASE}/api/emr/${patientId}/risk-factors`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        // Domain C: Structural - Right Eye (OD)
                        cdr_od: mapCdrToTRBS(examData.discCdr.re),
                        notching_od: mapNotchToTRBS(examData.discNotch.re),
                        disc_hemorrhage_od: mapHemorrhageToTRBS(examData.discHemorrhage?.re),
                        // Domain C: Structural - Left Eye (OS)
                        cdr_os: mapCdrToTRBS(examData.discCdr.le),
                        notching_os: mapNotchToTRBS(examData.discNotch.le),
                        disc_hemorrhage_os: mapHemorrhageToTRBS(examData.discHemorrhage?.le)
                    })
                });

                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(new Date().toISOString());
                
                if (onDataChange) {
                    onDataChange('fundusexam', { examData });
                }
                
                alert('✓ Fundus exam saved! Data will auto-populate in Target IOP Calculator.');
            }
        } catch (error) {
            console.error('Error saving fundus exam:', error);
            alert('Error saving data. Please try again.');
        }
    };

    const handleChange = (field, eye, value) => {
        setExamData(prev => ({
            ...prev,
            [field]: { ...prev[field], [eye]: value }
        }));
    };

    const handleEdit = () => setIsEditing(true);

    if (loading) {
        return <div className="emr-fundus-container"><div className="loading">Loading...</div></div>;
    }

    return (
        <div className="emr-fundus-container">
            <div className="emr-section-header">
                <h3>👁️ Fundus Examination</h3>
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
                    Fundus findings contribute to <strong>Domain C: Structural Changes</strong> in Target IOP calculation.
                </p>

                {isEditing ? (
                    <>
                        <table className="exam-table">
                            <thead>
                                <tr>
                                    <th className="label-col">Parameter</th>
                                    <th className="eye-col">Right Eye (OD)</th>
                                    <th className="eye-col">Left Eye (OS)</th>
                                    <th className="risk-col">TRBS Impact</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="label-cell">Media</td>
                                    <td><input type="text" placeholder="Clear" value={examData.media.re} onChange={(e) => handleChange('media', 're', e.target.value)} /></td>
                                    <td><input type="text" placeholder="Clear" value={examData.media.le} onChange={(e) => handleChange('media', 'le', e.target.value)} /></td>
                                    <td className="risk-info-cell">-</td>
                                </tr>
                                <tr className="highlight-row">
                                    <td className="label-cell">
                                        <strong>Disc - CDR</strong>
                                        <span className="risk-badge">Domain C</span>
                                    </td>
                                    <td>
                                        <select value={examData.discCdr.re} onChange={(e) => handleChange('discCdr', 're', e.target.value)}>
                                            <option value="">Select CDR</option>
                                            {cdrOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select value={examData.discCdr.le} onChange={(e) => handleChange('discCdr', 'le', e.target.value)}>
                                            <option value="">Select CDR</option>
                                            {cdrOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </td>
                                    <td className="risk-info-cell">
                                        ≤0.5: 0pts | 0.6: 1pt | 0.7: 2pts | 0.8: 3pts | ≥0.9: 4pts
                                    </td>
                                </tr>
                                <tr className="highlight-row">
                                    <td className="label-cell">
                                        <strong>Disc - Notching</strong>
                                        <span className="risk-badge">Domain C</span>
                                    </td>
                                    <td>
                                        <select value={examData.discNotch.re} onChange={(e) => handleChange('discNotch', 're', e.target.value)}>
                                            {notchOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select value={examData.discNotch.le} onChange={(e) => handleChange('discNotch', 'le', e.target.value)}>
                                            {notchOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </td>
                                    <td className="risk-info-cell">
                                        Absent: 0pts | Present: 3pts
                                    </td>
                                </tr>
                                <tr className="highlight-row">
                                    <td className="label-cell">
                                        <strong>Disc Hemorrhage</strong>
                                        <span className="risk-badge">Domain C</span>
                                    </td>
                                    <td>
                                        <select value={examData.discHemorrhage?.re || ''} onChange={(e) => handleChange('discHemorrhage', 're', e.target.value)}>
                                            {hemorrhageOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select value={examData.discHemorrhage?.le || ''} onChange={(e) => handleChange('discHemorrhage', 'le', e.target.value)}>
                                            {hemorrhageOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </td>
                                    <td className="risk-info-cell">
                                        Absent: 0pts | Present: 1pt
                                    </td>
                                </tr>
                                <tr>
                                    <td className="label-cell">Disc - PPA</td>
                                    <td><input type="text" placeholder="Present/Absent" value={examData.discPpa.re} onChange={(e) => handleChange('discPpa', 're', e.target.value)} /></td>
                                    <td><input type="text" placeholder="Present/Absent" value={examData.discPpa.le} onChange={(e) => handleChange('discPpa', 'le', e.target.value)} /></td>
                                    <td className="risk-info-cell">-</td>
                                </tr>
                                <tr>
                                    <td className="label-cell">RNFL Defect</td>
                                    <td><input type="text" placeholder="Describe defect" value={examData.rnflDefect?.re || ''} onChange={(e) => handleChange('rnflDefect', 're', e.target.value)} /></td>
                                    <td><input type="text" placeholder="Describe defect" value={examData.rnflDefect?.le || ''} onChange={(e) => handleChange('rnflDefect', 'le', e.target.value)} /></td>
                                    <td className="risk-info-cell">-</td>
                                </tr>
                                <tr>
                                    <td className="label-cell">Vessels</td>
                                    <td><input type="text" placeholder="Normal" value={examData.vessels.re} onChange={(e) => handleChange('vessels', 're', e.target.value)} /></td>
                                    <td><input type="text" placeholder="Normal" value={examData.vessels.le} onChange={(e) => handleChange('vessels', 'le', e.target.value)} /></td>
                                    <td className="risk-info-cell">-</td>
                                </tr>
                                <tr>
                                    <td className="label-cell">Background Retina</td>
                                    <td><input type="text" placeholder="Normal" value={examData.backgroundRetina.re} onChange={(e) => handleChange('backgroundRetina', 're', e.target.value)} /></td>
                                    <td><input type="text" placeholder="Normal" value={examData.backgroundRetina.le} onChange={(e) => handleChange('backgroundRetina', 'le', e.target.value)} /></td>
                                    <td className="risk-info-cell">-</td>
                                </tr>
                                <tr>
                                    <td className="label-cell">Macula/Foveal Reflex</td>
                                    <td><input type="text" placeholder="Present" value={examData.maculaFovealReflex.re} onChange={(e) => handleChange('maculaFovealReflex', 're', e.target.value)} /></td>
                                    <td><input type="text" placeholder="Present" value={examData.maculaFovealReflex.le} onChange={(e) => handleChange('maculaFovealReflex', 'le', e.target.value)} /></td>
                                    <td className="risk-info-cell">-</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="action-row">
                            <button className="btn-save" onClick={handleSave}>💾 Save Fundus Exam</button>
                            {isSaved && <button className="btn-cancel" onClick={() => setIsEditing(false)}>Cancel</button>}
                        </div>
                    </>
                ) : (
                    <div className="saved-data-display">
                        <table className="display-table">
                            <thead>
                                <tr>
                                    <th>Parameter</th>
                                    <th>Right Eye (OD)</th>
                                    <th>Left Eye (OS)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td><strong>CDR</strong></td><td>{examData.discCdr.re || '-'}</td><td>{examData.discCdr.le || '-'}</td></tr>
                                <tr><td><strong>Notching</strong></td><td>{examData.discNotch.re || '-'}</td><td>{examData.discNotch.le || '-'}</td></tr>
                                <tr><td><strong>Disc Hemorrhage</strong></td><td>{examData.discHemorrhage?.re || '-'}</td><td>{examData.discHemorrhage?.le || '-'}</td></tr>
                                <tr><td>Media</td><td>{examData.media.re || '-'}</td><td>{examData.media.le || '-'}</td></tr>
                                <tr><td>PPA</td><td>{examData.discPpa.re || '-'}</td><td>{examData.discPpa.le || '-'}</td></tr>
                                <tr><td>RNFL Defect</td><td>{examData.rnflDefect?.re || '-'}</td><td>{examData.rnflDefect?.le || '-'}</td></tr>
                                <tr><td>Vessels</td><td>{examData.vessels.re || '-'}</td><td>{examData.vessels.le || '-'}</td></tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
