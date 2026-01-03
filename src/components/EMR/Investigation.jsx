import React, { useState, useEffect } from 'react';
import './Investigation.css';

const API_BASE = 'http://localhost:8000';

export default function Investigation({ patientId, onDataChange }) {
    const [investigations, setInvestigations] = useState({
        iop: { re: '', le: '', dateTime: '' },
        bp: { value: '', dateTime: '' },
        pachymetry: { re: '', le: '', dateTime: '' }
    });

    const [dilation, setDilation] = useState({
        status: '',
        time: '',
        dropsUsed: ''
    });

    const [isEditing, setIsEditing] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savedAt, setSavedAt] = useState(null);

    useEffect(() => {
        if (patientId) {
            loadData();
        }
    }, [patientId]);

    const loadData = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/investigation`);
            const result = await response.json();

            if (result.exists && result.data) {
                if (result.data.investigations) {
                    // Merge with defaults to ensure all properties exist
                    setInvestigations(prev => ({
                        iop: { re: '', le: '', dateTime: '', ...result.data.investigations.iop },
                        bp: { value: '', dateTime: '', ...result.data.investigations.bp },
                        pachymetry: { re: '', le: '', dateTime: '', ...result.data.investigations.pachymetry }
                    }));
                }
                if (result.data.dilation) {
                    setDilation(prev => ({
                        status: '',
                        time: '',
                        dropsUsed: '',
                        ...result.data.dilation
                    }));
                }
                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(result.updated_at || result.created_at);
            }
        } catch (error) {
            console.error('Error loading investigation data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/investigation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { investigations, dilation },
                    created_by: 'Dr. User'
                })
            });

            if (response.ok) {
                setIsSaved(true);
                setIsEditing(false);
                setSavedAt(new Date().toISOString());
                
                if (onDataChange) {
                    onDataChange('investigation', { investigations, dilation });
                }
                alert('Investigation saved successfully!');
            }
        } catch (error) {
            console.error('Error saving investigation data:', error);
            alert('Error saving data. Please try again.');
        }
    };

    const getCurrentDateTime = () => {
        const now = new Date();
        return now.toLocaleString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const setCurrentDateTime = (field) => {
        const dateTime = getCurrentDateTime();
        setInvestigations(prev => ({
            ...prev,
            [field]: { ...prev[field], dateTime }
        }));
    };

    if (loading) {
        return <div className="investigation-container"><div className="loading">Loading...</div></div>;
    }

    return (
        <div className="investigation-container">
            {/* Investigations Card */}
            <div className="investigation-card">
                <div className="card-header">
                    <span className="investigations-badge">Investigations</span>
                </div>

                {/* Investigations Table */}
                <div className="inv-table-wrapper">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th className="col-investigation">Investigation</th>
                                <th className="col-re">RE</th>
                                <th className="col-le">LE</th>
                                <th className="col-datetime">Date & Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* IOP Row */}
                            <tr>
                                <td className="inv-name">IOP</td>
                                <td>
                                    <input
                                        type="text"
                                        className="inv-input"
                                        placeholder="18 mm Hg"
                                        value={investigations.iop.re}
                                        onChange={(e) => setInvestigations(prev => ({
                                            ...prev,
                                            iop: { ...prev.iop, re: e.target.value }
                                        }))}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="inv-input"
                                        placeholder="16 mm Hg"
                                        value={investigations.iop.le}
                                        onChange={(e) => setInvestigations(prev => ({
                                            ...prev,
                                            iop: { ...prev.iop, le: e.target.value }
                                        }))}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="inv-input datetime"
                                        placeholder="16 Dec 2025 05:37 PM"
                                        value={investigations.iop.dateTime}
                                        onClick={() => !investigations.iop.dateTime && setCurrentDateTime('iop')}
                                        onChange={(e) => setInvestigations(prev => ({
                                            ...prev,
                                            iop: { ...prev.iop, dateTime: e.target.value }
                                        }))}
                                    />
                                </td>
                            </tr>

                            {/* BP Row */}
                            <tr>
                                <td className="inv-name">BP</td>
                                <td colSpan="2">
                                    <input
                                        type="text"
                                        className="inv-input wide"
                                        placeholder="140 / 80 mm Hg"
                                        value={investigations.bp.value}
                                        onChange={(e) => setInvestigations(prev => ({
                                            ...prev,
                                            bp: { ...prev.bp, value: e.target.value }
                                        }))}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="inv-input datetime"
                                        placeholder="16 Dec 2025 05:37 PM"
                                        value={investigations.bp.dateTime}
                                        onClick={() => !investigations.bp.dateTime && setCurrentDateTime('bp')}
                                        onChange={(e) => setInvestigations(prev => ({
                                            ...prev,
                                            bp: { ...prev.bp, dateTime: e.target.value }
                                        }))}
                                    />
                                </td>
                            </tr>

                            {/* Pachymetry Row */}
                            <tr>
                                <td className="inv-name">Pachymetry</td>
                                <td>
                                    <input
                                        type="text"
                                        className="inv-input"
                                        placeholder="520 μm"
                                        value={investigations.pachymetry.re}
                                        onChange={(e) => setInvestigations(prev => ({
                                            ...prev,
                                            pachymetry: { ...prev.pachymetry, re: e.target.value }
                                        }))}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="inv-input"
                                        placeholder="518 μm"
                                        value={investigations.pachymetry.le}
                                        onChange={(e) => setInvestigations(prev => ({
                                            ...prev,
                                            pachymetry: { ...prev.pachymetry, le: e.target.value }
                                        }))}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="inv-input datetime"
                                        placeholder="16 Dec 2025 05:37 PM"
                                        value={investigations.pachymetry.dateTime}
                                        onClick={() => !investigations.pachymetry.dateTime && setCurrentDateTime('pachymetry')}
                                        onChange={(e) => setInvestigations(prev => ({
                                            ...prev,
                                            pachymetry: { ...prev.pachymetry, dateTime: e.target.value }
                                        }))}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dilation Section */}
            <div className="dilation-section">
                <h4 className="dilation-title">Dilation</h4>
                
                <div className="dilation-card">
                    <div className="dilation-fields">
                        <div className="dilation-field">
                            <label>Dilation Status</label>
                            <select
                                value={dilation.status}
                                onChange={(e) => setDilation(prev => ({ ...prev, status: e.target.value }))}
                            >
                                <option value="">Select</option>
                                <option value="Dilated">Dilated</option>
                                <option value="Not Dilated">Not Dilated</option>
                                <option value="Partially Dilated">Partially Dilated</option>
                            </select>
                        </div>

                        <div className="dilation-field">
                            <label>Time of Dilation</label>
                            <div className="time-input-wrapper">
                                <input
                                    type="text"
                                    placeholder="--:--"
                                    value={dilation.time}
                                    onChange={(e) => setDilation(prev => ({ ...prev, time: e.target.value }))}
                                />
                                <span className="time-icon">🕐</span>
                            </div>
                        </div>

                        <div className="dilation-field">
                            <label>Drops Used</label>
                            <input
                                type="text"
                                placeholder="e.g., Tropicamide 1%"
                                value={dilation.dropsUsed}
                                onChange={(e) => setDilation(prev => ({ ...prev, dropsUsed: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="investigation-actions">
                <button className="btn-save-investigation" onClick={handleSave}>
                    Save Investigation
                </button>
            </div>
        </div>
    );
}
