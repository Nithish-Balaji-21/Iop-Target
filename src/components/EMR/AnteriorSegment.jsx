import React, { useState, useEffect } from 'react';
import './AnteriorSegment.css';

const API_BASE = 'http://localhost:8000';

export default function AnteriorSegment({ patientId, onDataChange }) {
    const [examData, setExamData] = useState({
        anteriorChamber: { re: '', le: '' },
        iris: { re: '', le: '' },
        pupil: { re: '', le: '' },
        lens: { re: '', le: '' }
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
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/anterior-segment`);
            const result = await response.json();

            if (result.exists && result.data) {
                setExamData(result.data.examData || examData);
                setIsSaved(true);
            }
        } catch (error) {
            console.error('Error loading anterior segment data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/anterior-segment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { examData },
                    created_by: 'Dr. User'
                })
            });

            if (response.ok) {
                setIsSaved(true);
                if (onDataChange) {
                    onDataChange('anterior-segment', { examData });
                }
                alert('Anterior Segment Exam saved successfully!');
            }
        } catch (error) {
            console.error('Error saving anterior segment data:', error);
            alert('Error saving data. Please try again.');
        }
    };

    const handleClear = () => {
        setExamData({
            anteriorChamber: { re: '', le: '' },
            iris: { re: '', le: '' },
            pupil: { re: '', le: '' },
            lens: { re: '', le: '' }
        });
    };

    const handleChange = (field, eye, value) => {
        setExamData(prev => ({
            ...prev,
            [field]: {
                ...prev[field],
                [eye]: value
            }
        }));
    };

    const getCurrentDateTime = () => {
        const now = new Date();
        return now.toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    if (loading) {
        return <div className="anterior-segment-container"><div className="loading">Loading...</div></div>;
    }

    return (
        <div className="anterior-segment-container">
            {/* Header */}
            <div className="anterior-segment-header">
                <span className="header-title">Ant. Segment Exam</span>
            </div>

            {/* Exam Card */}
            <div className="anterior-segment-card">
                <div className="card-header">
                    <span className="exam-badge">Anterior Segment Exam</span>
                </div>
                <div className="card-meta">
                    <span className="doctor-info">Dr. Chris Diana Pius @ {getCurrentDateTime()}</span>
                </div>

                {/* Exam Table */}
                <div className="exam-table">
                    {/* Table Header */}
                    <div className="exam-row header">
                        <div className="col-field"></div>
                        <div className="col-re">Right Eye</div>
                        <div className="col-le">Left Eye</div>
                    </div>

                    {/* Anterior Chamber Row */}
                    <div className="exam-row">
                        <div className="col-field">Anterior Chamber</div>
                        <div className="col-re">
                            <input
                                type="text"
                                className="exam-input"
                                placeholder="Normal Depth"
                                value={examData.anteriorChamber.re}
                                onChange={(e) => handleChange('anteriorChamber', 're', e.target.value)}
                            />
                        </div>
                        <div className="col-le">
                            <input
                                type="text"
                                className="exam-input"
                                placeholder="Normal Depth"
                                value={examData.anteriorChamber.le}
                                onChange={(e) => handleChange('anteriorChamber', 'le', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Iris Row */}
                    <div className="exam-row">
                        <div className="col-field">Iris</div>
                        <div className="col-re">
                            <input
                                type="text"
                                className="exam-input"
                                placeholder="Normal Color and Pattern"
                                value={examData.iris.re}
                                onChange={(e) => handleChange('iris', 're', e.target.value)}
                            />
                        </div>
                        <div className="col-le">
                            <input
                                type="text"
                                className="exam-input"
                                placeholder="Normal Color and Pattern"
                                value={examData.iris.le}
                                onChange={(e) => handleChange('iris', 'le', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Pupil Row */}
                    <div className="exam-row">
                        <div className="col-field">Pupil</div>
                        <div className="col-re">
                            <input
                                type="text"
                                className="exam-input"
                                placeholder="Pharmacologically Dilated"
                                value={examData.pupil.re}
                                onChange={(e) => handleChange('pupil', 're', e.target.value)}
                            />
                        </div>
                        <div className="col-le">
                            <input
                                type="text"
                                className="exam-input"
                                placeholder="Pharmacologically Dilated"
                                value={examData.pupil.le}
                                onChange={(e) => handleChange('pupil', 'le', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Lens Row */}
                    <div className="exam-row">
                        <div className="col-field">Lens</div>
                        <div className="col-re">
                            <input
                                type="text"
                                className="exam-input"
                                placeholder="PCIOL"
                                value={examData.lens.re}
                                onChange={(e) => handleChange('lens', 're', e.target.value)}
                            />
                        </div>
                        <div className="col-le">
                            <input
                                type="text"
                                className="exam-input"
                                placeholder="PCIOL"
                                value={examData.lens.le}
                                onChange={(e) => handleChange('lens', 'le', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="exam-actions">
                    <button className="btn-save-exam" onClick={handleSave}>Save</button>
                    <button className="btn-cancel-exam" onClick={handleClear}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
