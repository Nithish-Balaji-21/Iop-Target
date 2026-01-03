import React, { useState, useEffect } from 'react';
import './Refraction.css';

const API_BASE = 'http://localhost:8000';

export default function Refraction({ patientId, onDataChange }) {
    const [prescription, setPrescription] = useState({
        distance: {
            od: { sph: '', cyl: '', axis: '' },
            os: { sph: '', cyl: '', axis: '' },
            pd: '',
            lensType: ''
        },
        near: {
            od: { sph: '', cyl: '', axis: '' },
            os: { sph: '', cyl: '', axis: '' },
            pd: '',
            lensType: ''
        }
    });

    const [loading, setLoading] = useState(true);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (patientId) {
            loadData();
        }
    }, [patientId]);

    const loadData = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/refraction`);
            const result = await response.json();

            if (result.exists && result.data) {
                setPrescription(result.data.prescription || prescription);
                setIsSaved(true);
            }
        } catch (error) {
            console.error('Error loading refraction data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/refraction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { prescription },
                    created_by: 'Dr. User'
                })
            });

            if (response.ok) {
                // Helper function to convert SPH to myopia category
                const sphToMyopia = (sphStr) => {
                    if (!sphStr || sphStr === '') return null;
                    try {
                        const sphClean = String(sphStr).trim().replace('+', '').replace('DS', '').replace('D', '').trim();
                        const sphValue = parseFloat(sphClean);
                        if (isNaN(sphValue)) return null;
                        
                        if (sphValue >= 0 || sphValue > -1) return 'none';
                        else if (sphValue >= -3) return 'low_myopia';
                        else return 'mod_high_myopia';
                    } catch {
                        return null;
                    }
                };

                // Extract SPH values and update risk factors
                const distance = prescription.distance || {};
                const odSph = distance.od?.sph || '';
                const osSph = distance.os?.sph || '';
                
                const myopiaOD = sphToMyopia(odSph);
                const myopiaOS = sphToMyopia(osSph);

                // Update risk factors with myopia data
                if (myopiaOD || myopiaOS) {
                    try {
                        const riskFactorsBody = {};
                        if (myopiaOD) riskFactorsBody.myopia_od = myopiaOD;
                        if (myopiaOS) riskFactorsBody.myopia_os = myopiaOS;
                        
                        await fetch(`${API_BASE}/api/emr/${patientId}/risk-factors`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(riskFactorsBody)
                        });
                    } catch (err) {
                        console.error('Error updating risk factors:', err);
                    }
                }

                setIsSaved(true);
                if (onDataChange) {
                    onDataChange('refraction', { prescription });
                }
                alert('✓ Refraction saved! Myopia data will auto-populate in Target IOP Calculator.');
            }
        } catch (error) {
            console.error('Error saving refraction data:', error);
            alert('Error saving data. Please try again.');
        }
    };

    const handleChange = (type, eye, field, value) => {
        setPrescription(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [eye]: typeof prev[type][eye] === 'object' 
                    ? { ...prev[type][eye], [field]: value }
                    : value
            }
        }));
    };

    const handleFieldChange = (type, field, value) => {
        setPrescription(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [field]: value
            }
        }));
    };

    if (loading) {
        return <div className="refraction-container"><div className="loading">Loading...</div></div>;
    }

    return (
        <div className="refraction-container">
            {/* Header */}
            <div className="refraction-header">
                <span className="refraction-title">Refraction</span>
            </div>

            {/* Prescription Card */}
            <div className="refraction-card">
                <h3 className="prescription-title">Sample Prescription</h3>

                <div className="prescription-table-wrapper">
                    <table className="prescription-table">
                        <thead>
                            <tr>
                                <th className="col-type" rowSpan="2"></th>
                                <th className="col-eye-group" colSpan="3">OD</th>
                                <th className="col-eye-group" colSpan="3">OS</th>
                                <th className="col-pd" rowSpan="2">PD</th>
                                <th className="col-lens" rowSpan="2">LENS<br/>TYPE</th>
                            </tr>
                            <tr>
                                <th className="col-sub">SPH</th>
                                <th className="col-sub">CYL</th>
                                <th className="col-sub">AXIS</th>
                                <th className="col-sub">SPH</th>
                                <th className="col-sub">CYL</th>
                                <th className="col-sub">AXIS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Distance Row */}
                            <tr>
                                <td className="row-label">Distance</td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.distance.od.sph}
                                        onChange={(e) => handleChange('distance', 'od', 'sph', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.distance.od.cyl}
                                        onChange={(e) => handleChange('distance', 'od', 'cyl', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.distance.od.axis}
                                        onChange={(e) => handleChange('distance', 'od', 'axis', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.distance.os.sph}
                                        onChange={(e) => handleChange('distance', 'os', 'sph', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.distance.os.cyl}
                                        onChange={(e) => handleChange('distance', 'os', 'cyl', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.distance.os.axis}
                                        onChange={(e) => handleChange('distance', 'os', 'axis', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.distance.pd}
                                        onChange={(e) => handleFieldChange('distance', 'pd', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.distance.lensType}
                                        onChange={(e) => handleFieldChange('distance', 'lensType', e.target.value)}
                                    />
                                </td>
                            </tr>

                            {/* Near Row */}
                            <tr>
                                <td className="row-label">Near</td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.near.od.sph}
                                        onChange={(e) => handleChange('near', 'od', 'sph', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.near.od.cyl}
                                        onChange={(e) => handleChange('near', 'od', 'cyl', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.near.od.axis}
                                        onChange={(e) => handleChange('near', 'od', 'axis', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.near.os.sph}
                                        onChange={(e) => handleChange('near', 'os', 'sph', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.near.os.cyl}
                                        onChange={(e) => handleChange('near', 'os', 'cyl', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.near.os.axis}
                                        onChange={(e) => handleChange('near', 'os', 'axis', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.near.pd}
                                        onChange={(e) => handleFieldChange('near', 'pd', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="rx-input"
                                        value={prescription.near.lensType}
                                        onChange={(e) => handleFieldChange('near', 'lensType', e.target.value)}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Save Button */}
                <div className="refraction-actions">
                    <button className="btn-save-refraction" onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
}
