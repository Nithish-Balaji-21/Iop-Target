import React, { useState, useEffect } from 'react';
import { Search, Info, Plus, ChevronDown, Clock, Menu, X, AlertCircle } from 'lucide-react';
import './PatientQueue.css';

// Helper function to calculate elapsed time
function getElapsedTime(checkInTimestamp) {
    if (!checkInTimestamp) return '0 Mins';
    const elapsed = Date.now() - checkInTimestamp;
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours} Hrs ${minutes} Mins`;
    }
    return `${minutes} Mins`;
}

export default function PatientQueue({ doctorName, onPatientSelect, onLogout }) {
    const [patients, setPatients] = useState([]);
    const [activeTab, setActiveTab] = useState('All');
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // MR Verification Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [mrInput, setMrInput] = useState('');
    const [error, setError] = useState('');

    // Add Patient Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newPatient, setNewPatient] = useState({
        name: '',
        patient_id: '',
        age: '',
        gender: 'Male',
        glaucoma_type: 'POAG',
        visit_date: ''
    });
    const [addError, setAddError] = useState('');

    // Fetch patients from backend
    useEffect(() => {
        fetchPatients();
    }, []);

    // Update elapsed time every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchPatients = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/patients/');
            if (response.ok) {
                const data = await response.json();
                // For each patient, fetch the latest visit (if any) to display visit date in queue
                const mapped = await Promise.all(data.map(async (p) => {
                    let lastVisitDate = null;
                    let checkInTimestamp = p.created_at ? new Date(p.created_at).getTime() : Date.now();
                    try {
                        const vResp = await fetch(`http://localhost:8000/api/risk/${p.id}/visits?limit=1`);
                        if (vResp.ok) {
                            const visits = await vResp.json();
                            if (Array.isArray(visits) && visits.length > 0) {
                                lastVisitDate = visits[0].visit_date;
                                checkInTimestamp = new Date(visits[0].visit_date).getTime();
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching visits for patient', p.id, err);
                    }

                    return {
                        id: p.id,
                        name: p.name,
                        mrNumber: p.patient_id,
                        age: p.age,
                        gender: p.gender || 'Male',
                        visitType: 'R', // Review
                        purpose: p.glaucoma_type || 'Glaucoma Follow-up',
                        assignedTo: doctorName,
                        lastVisitDate: lastVisitDate ? new Date(lastVisitDate).toLocaleDateString() : (p.created_at ? new Date(p.created_at).toLocaleDateString() : '---'),
                        lastClinic: 'GLAUCOMA',
                        lastTreatment: '',
                        checkInTimestamp: checkInTimestamp,
                        status: 'Waiting'
                    };
                }));
                setPatients(mapped);
            }
        } catch (err) {
            console.error('Error fetching patients:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePatientClick = (patient) => {
        setSelectedPatient(patient);
        setMrInput('');
        setError('');
        setShowModal(true);
    };

    const handleVerify = () => {
        if (!mrInput) {
            setError('Please enter the last 3 digits');
            return;
        }

        const patientMR = selectedPatient.mrNumber || '';
        const last3Digits = patientMR.toString().slice(-3);

        if (mrInput === last3Digits) {
            setShowModal(false);
            onPatientSelect(selectedPatient.id);
        } else {
            setError(`Incorrect! Please enter the correct MR Number digits. (Hint: last 3 digits of ${patientMR})`);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedPatient(null);
        setMrInput('');
        setError('');
    };

    // Add Patient handlers
    const handleAddPatient = async () => {
        if (!newPatient.name || !newPatient.patient_id || !newPatient.age) {
            setAddError('Please fill all required fields');
            return;
        }

        try {
                const response = await fetch('http://localhost:8000/api/patients/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...newPatient,
                        age: parseInt(newPatient.age)
                    })
                });

                if (response.ok) {
                    const created = await response.json();

                    // If a visit_date was provided while adding the patient, create a Visit record too
                    if (newPatient.visit_date && newPatient.visit_date.trim() !== '') {
                        try {
                            // Normalize date string to ISO datetime expected by backend
                            let visitDateIso = newPatient.visit_date;
                            // If only a date (YYYY-MM-DD) supplied, append midnight time
                            if (!visitDateIso.includes('T')) visitDateIso = visitDateIso + 'T00:00:00';
                            // Ensure seconds present
                            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(visitDateIso)) visitDateIso = visitDateIso + ':00';

                            const visitPayload = {
                                patient_id: created.id,
                                visit_date: visitDateIso,
                                visit_type: 'ROUTINE',
                                findings: null,
                                treatment_changes: null,
                                doctor_notes: null,
                                created_by: 'FrontDesk'
                            };

                            await fetch(`http://localhost:8000/api/risk/${created.id}/visit`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(visitPayload)
                            });
                        } catch (err) {
                            console.error('Error creating initial visit for patient:', err);
                        }
                    }

                    setShowAddModal(false);
                    setNewPatient({ name: '', patient_id: '', age: '', gender: 'Male', glaucoma_type: 'POAG', visit_date: '' });
                    setAddError('');
                    fetchPatients(); // Refresh list
                } else {
                    const errData = await response.json();
                    setAddError(errData.detail || 'Failed to add patient');
                }
        } catch (err) {
            setAddError('Error connecting to server');
        }
    };

    const filteredPatients = patients.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.mrNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="queue-page">
            {/* MR Number Verification Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button className="modal-close" onClick={handleCloseModal}>
                            <X size={18} />
                        </button>
                        <div className="modal-header">
                            <span className="patient-highlight">{selectedPatient?.name}</span>
                            <span style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px', display: 'block' }}>
                                MR: {selectedPatient?.mrNumber}
                            </span>
                        </div>
                        <div className="modal-body">
                            <label>Enter last 3 digits of MR Number</label>
                            <input
                                type="text"
                                value={mrInput}
                                onChange={(e) => {
                                    setMrInput(e.target.value);
                                    setError('');
                                }}
                                maxLength={3}
                                placeholder="_ _ _"
                                className="mr-verify-input"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                            />
                            {error && (
                                <div className="error-message">
                                    <AlertCircle size={14} />
                                    {error}
                                </div>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn-verify" onClick={handleVerify}>Verify & Open</button>
                            <button className="btn-cancel" onClick={handleCloseModal}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Blue Header */}
            <div className="queue-header">
                <div className="header-left">
                    <span className="header-brand">i-Target</span>
                    <div className="op-toggle">
                        <span className="op-label">OP</span>
                    </div>
                    <div className="header-dropdown">
                        <select className="clinic-select">
                            <option>Glaucoma</option>
                        </select>
                        <ChevronDown size={12} className="dropdown-arrow" />
                    </div>
                    <div className="header-search">
                        <input 
                            type="text" 
                            placeholder="Patient Details" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search size={14} className="search-icon" />
                    </div>
                    <button className="waiting-list-btn">
                        Waiting List
                        <span className="waiting-count">{patients.length}</span>
                    </button>
                </div>

                <div className="header-right">
                    <div className="alert-badge">
                        <span className="alert-icon">⚠</span>
                        <span className="alert-text">REVT</span>
                    </div>
                    <div className="kpi-badges">
                        <div className="kpi-block">
                            <span className="kpi-label">Glaucoma Clinic</span>
                            <span className="kpi-value">{patients.length}</span>
                        </div>
                        <div className="kpi-block">
                            <span className="kpi-label">Waiting</span>
                            <span className="kpi-value">{patients.filter(p => p.status === 'Waiting').length}</span>
                        </div>
                        <div className="kpi-block">
                            <span className="kpi-label">&gt; 2 hrs</span>
                            <span className="kpi-value">0</span>
                        </div>
                        <div className="kpi-block">
                            <span className="kpi-label">VC</span>
                            <span className="kpi-value">0</span>
                        </div>
                        <div className="kpi-block highlight">
                            <span className="kpi-label">Total OP</span>
                            <span className="kpi-value">{patients.length}</span>
                        </div>
                    </div>
                    <div className="user-menu" onClick={onLogout}>
                        <span className="user-name">{doctorName}</span>
                        <Menu size={18} />
                    </div>
                </div>
            </div>

            {/* Tabs Row */}
            <div className="tabs-row">
                <div className="tabs-left">
                    <div
                        className={`tab ${activeTab === 'Assigned' ? 'active' : ''}`}
                        onClick={() => setActiveTab('Assigned')}
                    >
                        Assigned
                    </div>
                    <div
                        className={`tab ${activeTab === 'All' ? 'active' : ''}`}
                        onClick={() => setActiveTab('All')}
                    >
                        All ({patients.length})
                    </div>
                    <div
                        className={`tab ${activeTab === 'Completed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('Completed')}
                    >
                        Completed (0)
                    </div>
                </div>
                <div className="tabs-right">
                    <div className="tab tele-tab">Tele Ophthalmology (0)</div>
                </div>
            </div>

            {/* Patient Table */}
            <div className="patient-table-container">
                {loading ? (
                    <div className="loading-message">Loading patients...</div>
                ) : (
                    <table className="patient-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}></th>
                                <th>Patient Details</th>
                                <th>Age</th>
                                <th>Sex</th>
                                <th>Purpose of Visit</th>
                                <th>Examined/Assigned To</th>
                                <th>Last Visit Date & Clinic</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.map((patient, index) => (
                                <tr
                                    key={patient.id}
                                    onClick={() => handlePatientClick(patient)}
                                    className={index % 2 === 0 ? 'row-alt' : ''}
                                >
                                    <td className="text-center">
                                        <div className="info-icon-circle">
                                            <Info size={14} />
                                        </div>
                                    </td>
                                    <td>
                                        <div className="patient-info-cell">
                                            <div className="patient-details-wrapper">
                                                <div className="patient-name">{patient.name}</div>
                                                <div className="patient-parent">MR: {patient.mrNumber}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{patient.age} yrs</td>
                                    <td>
                                        <span className={`gender-circle gender-${patient.gender === 'Male' ? 'M' : 'F'}`}>
                                            {patient.gender === 'Male' ? 'M' : 'F'}
                                        </span>
                                    </td>
                                    <td className="purpose-cell">{patient.purpose}</td>
                                    <td>{patient.assignedTo}</td>
                                    <td>
                                        <div className="last-visit-container">
                                            <span className="last-visit-date">{patient.lastVisitDate}</span>
                                            <span className="last-visit-clinic">{patient.lastClinic}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer Bar */}
            <div className="queue-footer">
                <div className="footer-left">
                    <span className="location">Chennai</span>
                    <span className="version">v231225</span>
                </div>
                <div className="footer-center">
                    Copyright AC 2012 EMR. All rights reserved.
                </div>
                <div className="footer-right">
                    <button className="helpdesk-btn">
                        <span className="help-icon">📧</span>
                        Helpdesk
                    </button>
                    <span className="phone-numbers">Ext: 400, 401, 402, 403</span>
                </div>
            </div>

            {/* Floating New Patient Button */}
            <button className="fab-new-patient" onClick={() => setShowAddModal(true)}>
                <Plus size={20} />
            </button>

            {/* Add Patient Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content add-patient-modal">
                        <button className="modal-close" onClick={() => { setShowAddModal(false); setAddError(''); }}>
                            <X size={18} />
                        </button>
                        <div className="modal-header">
                            <span className="patient-highlight">Add New Patient</span>
                        </div>
                        <div className="modal-body">
                            <div className="add-form-group">
                                <label>Patient Name *</label>
                                <input
                                    type="text"
                                    value={newPatient.name}
                                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                                    placeholder="Enter patient name"
                                    className="add-form-input"
                                />
                            </div>
                            <div className="add-form-group">
                                <label>MR Number *</label>
                                <input
                                    type="text"
                                    value={newPatient.patient_id}
                                    onChange={(e) => setNewPatient({ ...newPatient, patient_id: e.target.value })}
                                    placeholder="Enter MR number (e.g., P001)"
                                    className="add-form-input"
                                />
                            </div>
                            <div className="add-form-row">
                                <div className="add-form-group">
                                    <label>Age *</label>
                                    <input
                                        type="number"
                                        value={newPatient.age}
                                        onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                                        placeholder="Age"
                                        className="add-form-input"
                                        min="1"
                                        max="120"
                                    />
                                </div>
                                <div className="add-form-group">
                                    <label>Gender</label>
                                    <select
                                        value={newPatient.gender}
                                        onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                                        className="add-form-input"
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                            </div>
                            <div className="add-form-group">
                                <label>Glaucoma Type</label>
                                <select
                                    value={newPatient.glaucoma_type}
                                    onChange={(e) => setNewPatient({ ...newPatient, glaucoma_type: e.target.value })}
                                    className="add-form-input"
                                >
                                    <option value="POAG">POAG - Primary Open-Angle Glaucoma</option>
                                    <option value="PACG">PACG - Primary Angle-Closure Glaucoma</option>
                                    <option value="NTG">NTG - Normal Tension Glaucoma</option>
                                    <option value="PXFG">PXFG - Pseudoexfoliation Glaucoma</option>
                                    <option value="PG">PG - Pigmentary Glaucoma</option>
                                    <option value="JG">JG - Juvenile Glaucoma</option>
                                    <option value="OHT">OHT - Ocular Hypertension</option>
                                </select>
                            </div>
                            <div className="add-form-group">
                                <label>Date of Visit *</label>
                                <input
                                    type="date"
                                    value={newPatient.visit_date}
                                    onChange={(e) => setNewPatient({ ...newPatient, visit_date: e.target.value })}
                                    className="add-form-input"
                                    required
                                />
                            </div>
                            {addError && (
                                <div className="error-message">
                                    <AlertCircle size={14} />
                                    {addError}
                                </div>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn-verify" onClick={handleAddPatient}>Add Patient</button>
                            <button className="btn-cancel" onClick={() => { setShowAddModal(false); setAddError(''); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
