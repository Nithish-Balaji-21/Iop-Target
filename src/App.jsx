import React, { useState, useEffect } from 'react';
import './App.css';
import { useApiHealth } from './hooks';
import Login from './pages/Login';
import PatientQueue from './pages/PatientQueue';
import PatientEMR from './pages/PatientEMR';

/**
 * Main Application Component
 * Manages authentication and page routing
 */
function App() {
  const [currentPage, setCurrentPage] = useState('login'); // 'login', 'queue', or 'emr'
  const [doctorName, setDoctorName] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const { isHealthy, isLoading: healthLoading } = useApiHealth();

  // Handle login
  const handleLogin = (name) => {
    setDoctorName(name);
    setCurrentPage('queue');
  };

  // Handle logout
  const handleLogout = () => {
    setDoctorName('');
    setCurrentPage('login');
    setSelectedPatientId(null);
  };

  // Handle patient selection
  const handlePatientSelect = (patientId) => {
    setSelectedPatientId(patientId);
    setCurrentPage('emr');
  };

  // Handle back to queue
  const handleBackToQueue = () => {
    setCurrentPage('queue');
    setSelectedPatientId(null);
  };

  // Render based on current page
  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <Login onLogin={handleLogin} />;
      case 'queue':
        return (
          <PatientQueue 
            doctorName={doctorName}
            onPatientSelect={handlePatientSelect}
            onLogout={handleLogout}
          />
        );
      case 'emr':
        return (
          <PatientEMR 
            patientId={selectedPatientId}
            doctorName={doctorName}
            onBackToQueue={handleBackToQueue}
          />
        );
      default:
        return <Login onLogin={handleLogin} />;
    }
  };

  return (
    <div className="app-container">
      {renderPage()}
    </div>
  );
}

export default App;
