/**
 * API Service - Handles all backend communication
 */

const API_BASE_URL = 'http://localhost:8000/api';

// ==================== PATIENTS ====================

export const patientService = {
  createPatient: async (patientData) => {
    const response = await fetch(`${API_BASE_URL}/patients/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData),
    });
    if (!response.ok) throw new Error('Failed to create patient');
    return response.json();
  },

  getPatient: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/patients/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch patient');
    return response.json();
  },

  listPatients: async (skip = 0, limit = 100) => {
    const response = await fetch(`${API_BASE_URL}/patients/?skip=${skip}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to list patients');
    return response.json();
  },

  updatePatient: async (patientId, patientData) => {
    const response = await fetch(`${API_BASE_URL}/patients/${patientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData),
    });
    if (!response.ok) throw new Error('Failed to update patient');
    return response.json();
  },

  deletePatient: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/patients/${patientId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete patient');
    return response.status === 204;
  },
};

// ==================== MEASUREMENTS ====================

export const measurementService = {
  recordMeasurement: async (patientId, measurementData) => {
    const response = await fetch(`${API_BASE_URL}/measurements/${patientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(measurementData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      const details = errorData.detail ? (Array.isArray(errorData.detail) ? errorData.detail.map(e => e.msg).join(', ') : errorData.detail) : 'Unknown error';
      throw new Error(`Failed to record measurement: ${details}`);
    }
    return response.json();
  },

  getMeasurements: async (patientId, days = 365, limit = 50) => {
    const response = await fetch(
      `${API_BASE_URL}/measurements/${patientId}?days=${days}&limit=${limit}`
    );
    if (!response.ok) throw new Error('Failed to fetch measurements');
    return response.json();
  },

  getLatestMeasurement: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/measurements/${patientId}/latest`);
    if (!response.ok) throw new Error('Failed to fetch latest measurement');
    return response.json();
  },

  getTrend: async (patientId, days = 365) => {
    const response = await fetch(
      `${API_BASE_URL}/measurements/${patientId}/trend?days=${days}`
    );
    if (!response.ok) throw new Error('Failed to fetch trend');
    return response.json();
  },
};

// ==================== TARGET PRESSURES ====================

export const targetService = {
  setTarget: async (patientId, targetData) => {
    const response = await fetch(`${API_BASE_URL}/targets/${patientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetData),
    });
    if (!response.ok) throw new Error('Failed to set target');
    return response.json();
  },

  getCurrentTarget: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/targets/${patientId}/current`);
    if (!response.ok) throw new Error('Failed to fetch current target');
    return response.json();
  },

  getTargetHistory: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/targets/${patientId}/history`);
    if (!response.ok) throw new Error('Failed to fetch target history');
    return response.json();
  },

  updateTarget: async (targetId, targetData) => {
    const response = await fetch(`${API_BASE_URL}/targets/${targetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetData),
    });
    if (!response.ok) throw new Error('Failed to update target');
    return response.json();
  },
};

// ==================== RISK ASSESSMENT ====================

export const riskService = {
  assessRisk: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/risk/${patientId}/assess`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to assess risk');
    return response.json();
  },

  createVisit: async (patientId, visitData) => {
    const response = await fetch(`${API_BASE_URL}/risk/${patientId}/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visitData),
    });
    if (!response.ok) throw new Error('Failed to create visit');
    return response.json();
  },

  getVisits: async (patientId, limit = 20) => {
    const response = await fetch(`${API_BASE_URL}/risk/${patientId}/visits?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch visits');
    return response.json();
  },

  getRiskSummary: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/risk/${patientId}/risk-summary`);
    if (!response.ok) throw new Error('Failed to fetch risk summary');
    return response.json();
  },
};

// ==================== HEALTH CHECK ====================

export const healthCheck = async () => {
  try {
    const response = await fetch('http://localhost:8000/health');
    return response.ok;
  } catch (error) {
    return false;
  }
};
