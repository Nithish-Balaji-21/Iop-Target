import React, { useState, useEffect } from 'react';
import './App.css';
import { useApiHealth } from './hooks';
import PatientList from './components/PatientList';
import PatientDashboard from './components/PatientDashboard';
import { Alert } from './components/Common';

/**
 * Main Application Component
 * Manages page state and navigation between patient list and dashboard
 * Provides real-time API health monitoring
 */
function App() {
  const [currentPage, setCurrentPage] = useState('list'); // 'list' or 'dashboard'
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const { isHealthy, isLoading: healthLoading, error: healthError } = useApiHealth();

  // Handle patient selection
  const handlePatientSelect = (patientId) => {
    setSelectedPatientId(patientId);
    setCurrentPage('dashboard');
  };

  // Handle back to list
  const handleBackToList = () => {
    setCurrentPage('list');
    setSelectedPatientId(null);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">Glaucoma IOP Monitor</h1>
            <p className="app-subtitle">Automated Intra-Ocular Pressure Monitoring & Risk Assessment</p>
          </div>
          <div className="header-right">
            {healthLoading ? (
              <div className="health-status loading">Checking API...</div>
            ) : isHealthy ? (
              <div className="health-status healthy">
                <span className="status-dot"></span>
                API Connected
              </div>
            ) : (
              <div className="health-status error">
                <span className="status-dot"></span>
                API Unavailable
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* API Health Alert */}
        {!isHealthy && !healthLoading && healthError && (
          <Alert type="warning">
            <strong>Backend Connection Issue:</strong> Cannot reach the API server. 
            Please ensure the backend is running on http://localhost:8000
          </Alert>
        )}

        {/* Page Navigation */}
        {currentPage === 'dashboard' && selectedPatientId && (
          <div className="page-header">
            <button className="btn-back" onClick={handleBackToList}>
              ← Back to Patient List
            </button>
          </div>
        )}

        {/* Conditional Rendering */}
        {currentPage === 'list' ? (
          <PatientList onSelectPatient={handlePatientSelect} />
        ) : (
          <PatientDashboard 
            patientId={selectedPatientId} 
            onBack={handleBackToList}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>&copy; 2024 Glaucoma IOP Monitoring System - Hackathon Project</p>
        <p className="backend-info">Backend: {isHealthy ? '✓ Running' : '✗ Offline'}</p>
      </footer>
    </div>
  );
}

export default App;
