import { useState, useEffect } from 'react';
import { patientService, measurementService, targetService, riskService, healthCheck } from '../services/api';

/**
 * Hook to fetch patients
 */
export const usePatients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPatients = async (skip = 0, limit = 100) => {
    setLoading(true);
    try {
      const data = await patientService.listPatients(skip, limit);
      setPatients(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  return { patients, loading, error, refetch: fetchPatients };
};

/**
 * Hook to fetch single patient
 */
export const usePatient = (patientId) => {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPatient = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await patientService.getPatient(patientId);
      setPatient(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  return { patient, loading, error, refetch: fetchPatient };
};

/**
 * Hook to fetch measurements
 */
export const useMeasurements = (patientId) => {
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMeasurements = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await measurementService.getMeasurements(patientId);
      setMeasurements(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeasurements();
  }, [patientId]);

  return { measurements, loading, error, refetch: fetchMeasurements };
};

/**
 * Hook to fetch latest measurement
 */
export const useLatestMeasurement = (patientId) => {
  const [measurement, setMeasurement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLatest = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await measurementService.getLatestMeasurement(patientId);
      setMeasurement(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, [patientId]);

  return { measurement, loading, error, refetch: fetchLatest };
};

/**
 * Hook to fetch trend data
 */
export const useTrendData = (patientId) => {
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrend = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await measurementService.getTrend(patientId);
      setTrend(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrend();
  }, [patientId]);

  return { trend, loading, error, refetch: fetchTrend };
};

/**
 * Hook to fetch current target
 */
export const useCurrentTarget = (patientId) => {
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTarget = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await targetService.getCurrentTarget(patientId);
      // Handle new format with exists flag
      if (data && data.exists !== false && data.target_iop_od) {
        setTarget(data);
      } else {
        setTarget(null);
      }
      setError(null);
    } catch (err) {
      setTarget(null);
      // Don't treat "no target" as an error
      if (!err.message.includes('404')) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTarget();
  }, [patientId]);

  return { target, loading, error, refetch: fetchTarget };
};

/**
 * Hook to fetch risk summary
 */
export const useRiskSummary = (patientId) => {
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRisk = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await riskService.getRiskSummary(patientId);
      setRisk(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, [patientId]);

  return { risk, loading, error, refetch: fetchRisk };
};

/**
 * Hook to check API health
 */
export const useApiHealth = () => {
  const [isHealthy, setIsHealthy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const healthy = await healthCheck();
      setIsHealthy(healthy);
      setLoading(false);
    };
    check();
  }, []);

  return { isHealthy, loading };
};
