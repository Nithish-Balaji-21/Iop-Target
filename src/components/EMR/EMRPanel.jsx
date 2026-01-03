import React, { useState, useEffect } from 'react';
import History from './History';
import FundusExam from './FundusExam';
import Investigation from './Investigation';
import VisualField from './VisualField';
import Diagnosis from './Diagnosis';
import './EMRPanel.css';

const API_BASE = 'http://localhost:8000';

/**
 * EMR Panel - Main container for EMR sections
 * Integrates with Target IOP Calculator by extracting risk factors from EMR data
 */
export default function EMRPanel({ patientId, onRiskFactorsUpdated }) {
    const [activeSection, setActiveSection] = useState('history');
    const [riskFactors, setRiskFactors] = useState(null);
    const [loading, setLoading] = useState(false);

    // Sections configuration
    const sections = [
        { id: 'history', label: '📋 History', component: History, domain: 'F' },
        { id: 'fundusexam', label: '👁️ Fundus Exam', component: FundusExam, domain: 'C' },
        { id: 'investigation', label: '🔬 Investigations', component: Investigation, domain: 'B, E' },
        { id: 'visualfield', label: '📊 Visual Field', component: VisualField, domain: 'D' },
        { id: 'diagnosis', label: '🏥 Diagnosis', component: Diagnosis, domain: 'E' }
    ];

    // Fetch extracted risk factors on mount
    useEffect(() => {
        if (patientId) {
            fetchRiskFactors();
        }
    }, [patientId]);

    const fetchRiskFactors = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/emr/${patientId}/risk-factors`);
            if (response.ok) {
                const data = await response.json();
                setRiskFactors(data.data);
                if (onRiskFactorsUpdated && data.exists) {
                    onRiskFactorsUpdated(data.data);
                }
            }
        } catch (error) {
            console.error('Error fetching risk factors:', error);
        } finally {
            setLoading(false);
        }
    };

    // Called when any EMR section saves data
    const handleDataChange = async (section, data) => {
        console.log(`EMR section ${section} updated:`, data);
        // Refetch risk factors after save
        setTimeout(() => {
            fetchRiskFactors();
        }, 500);
    };

    const ActiveComponent = sections.find(s => s.id === activeSection)?.component;

    return (
        <div className="emr-panel">
            {/* Header with auto-populate button */}
            <div className="emr-panel-header">
                <h2>📄 Electronic Medical Record</h2>
                <div className="emr-actions">
                    <button 
                        className="btn-refresh-risk"
                        onClick={fetchRiskFactors}
                        disabled={loading}
                    >
                        {loading ? '⏳ Loading...' : '🔄 Refresh Risk Factors'}
                    </button>
                </div>
            </div>

            {/* Risk Factors Summary */}
            {riskFactors && (
                <div className="risk-factors-summary">
                    <h4>📊 Extracted Risk Factors (for Target IOP)</h4>
                    <div className="risk-grid">
                        <div className="risk-item">
                            <span className="risk-label">CDR OD:</span>
                            <span className="risk-value">{riskFactors.cdr_od || 'N/A'}</span>
                        </div>
                        <div className="risk-item">
                            <span className="risk-label">CDR OS:</span>
                            <span className="risk-value">{riskFactors.cdr_os || 'N/A'}</span>
                        </div>
                        <div className="risk-item">
                            <span className="risk-label">CCT OD:</span>
                            <span className="risk-value">{riskFactors.cct_od} {riskFactors.pachymetry_od ? `(${riskFactors.pachymetry_od}μm)` : ''}</span>
                        </div>
                        <div className="risk-item">
                            <span className="risk-label">CCT OS:</span>
                            <span className="risk-value">{riskFactors.cct_os} {riskFactors.pachymetry_os ? `(${riskFactors.pachymetry_os}μm)` : ''}</span>
                        </div>
                        <div className="risk-item">
                            <span className="risk-label">Systemic:</span>
                            <span className="risk-value">
                                {riskFactors.systemic_factors?.length > 0 
                                    ? riskFactors.systemic_factors.join(', ') 
                                    : 'None'}
                            </span>
                        </div>
                        <div className="risk-item">
                            <span className="risk-label">Ocular (OD):</span>
                            <span className="risk-value">
                                {riskFactors.ocular_modifiers_od?.length > 0 
                                    ? riskFactors.ocular_modifiers_od.join(', ') 
                                    : 'None'}
                            </span>
                        </div>
                    </div>
                    {riskFactors.auto_extracted && (
                        <p className="auto-extracted-note">
                            ✨ Auto-extracted from EMR data
                            {riskFactors.manually_verified && ' ✓ Verified'}
                        </p>
                    )}
                </div>
            )}

            {/* Section Tabs */}
            <div className="emr-tabs">
                {sections.map(section => (
                    <button
                        key={section.id}
                        className={`emr-tab ${activeSection === section.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(section.id)}
                    >
                        {section.label}
                        <span className="domain-badge">Domain {section.domain}</span>
                    </button>
                ))}
            </div>

            {/* Active Section Content */}
            <div className="emr-section-container">
                {ActiveComponent && (
                    <ActiveComponent 
                        patientId={patientId} 
                        onDataChange={handleDataChange}
                    />
                )}
            </div>
        </div>
    );
}
