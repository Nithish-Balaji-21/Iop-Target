import React, { useState, useEffect } from 'react';
import '../styles/Dashboard.css';

/**
 * Jampel Target IOP Calculator Component
 * Calculates individual target IOP for each patient based on risk factors
 */
export const TargetIOPCalculator = ({ patientId, onTargetCalculated }) => {
  const [baselineIOPOD, setBaselineIOPOD] = useState(24);
  const [baselineIOPOS, setBaselineIOPOS] = useState(23);
  const [diseaseStage, setDiseaseStage] = useState('Early');
  const [diseaseSeverity, setDiseaseSeverity] = useState('Mild');
  
  const [riskFactors, setRiskFactors] = useState({
    baseline_iop_high: 'MODERATE',
    age_advanced: 'LOW',
    family_history: 'LOW',
    ethnicity_african_descent: 'LOW',
    central_corneal_thickness_thin: 'LOW',
    optic_disc_size_small: 'LOW',
    vertical_cup_disc_ratio_large: 'LOW',
    pseudoexfoliation_syndrome: 'LOW',
    pigment_dispersion_syndrome: 'LOW',
    previous_ischemic_events: 'LOW',
    myopia_high: 'LOW',
    diabetes: 'LOW',
    systemic_hypertension: 'LOW',
  });

  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRiskFactorChange = (factor, value) => {
    setRiskFactors(prev => ({
      ...prev,
      [factor]: value
    }));
  };

  const calculateTarget = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        baseline_iop_od: baselineIOPOD.toString(),
        baseline_iop_os: baselineIOPOS.toString(),
        disease_stage: diseaseStage,
        disease_severity: diseaseSeverity.toUpperCase()
      });

      // Add risk factors to query
      const riskFactorsStr = JSON.stringify(riskFactors);
      queryParams.append('risk_factors', riskFactorsStr);

      const response = await fetch(
        `http://localhost:8000/api/targets/${patientId}/calculate-jampel?${queryParams.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to calculate target (${response.status})`);
      }

      const data = await response.json();
      console.log('Calculation result:', data);
      setCalculation(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveTarget = async () => {
    if (!calculation) return;

    try {
      // Extract right_eye and left_eye from calculation result
      const calcData = calculation.calculation || calculation;
      
      const targetData = {
        patient_id: patientId,
        target_iop_od: parseFloat(calcData.right_eye.target),
        target_iop_os: parseFloat(calcData.left_eye.target),
        min_iop_od: parseFloat(calcData.right_eye.min_target),
        max_iop_od: parseFloat(calcData.right_eye.max_target),
        min_iop_os: parseFloat(calcData.left_eye.min_target),
        max_iop_os: parseFloat(calcData.left_eye.max_target),
        rationale: `Target set using Jampel Formula (Grade: ${calcData.risk_grade})`,
        set_by: 'Ophthalmologist'
      };

      console.log('Saving target with data:', targetData);

      const response = await fetch(
        `http://localhost:8000/api/targets/${patientId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(targetData)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save error:', response.status, errorText);
        throw new Error(`Failed to save target (${response.status})`);
      }

      alert('Target IOP saved successfully!');
      if (onTargetCalculated) {
        onTargetCalculated(targetData);
      }
    } catch (err) {
      console.error('Error in saveTarget:', err);
      alert('Error saving target: ' + err.message);
    }
  };

  const riskFactorLabels = {
    baseline_iop_high: 'High Baseline IOP',
    age_advanced: 'Advanced Age',
    family_history: 'Family History',
    ethnicity_african_descent: 'African Descent',
    central_corneal_thickness_thin: 'Thin Cornea',
    optic_disc_size_small: 'Small Optic Disc',
    vertical_cup_disc_ratio_large: 'Large Cup:Disc Ratio',
    pseudoexfoliation_syndrome: 'Pseudoexfoliation',
    pigment_dispersion_syndrome: 'Pigment Dispersion',
    previous_ischemic_events: 'Vascular Events',
    myopia_high: 'High Myopia',
    diabetes: 'Diabetes',
    systemic_hypertension: 'Hypertension',
  };

  return (
    <div className="card target-iop-calculator">
      <h2>🎯 Jampel Target IOP Calculator</h2>
      <p className="info-text">Based on HD Jampel Formula (1997) - Endorsed by AAO, EGS, WGA, NICE</p>

      {error && <div className="error-message">❌ {error}</div>}

      <div className="calculator-section">
        {/* Baseline IOP */}
        <div className="form-group">
          <label>Baseline IOP (mmHg)</label>
          <div className="iop-inputs">
            <div>
              <label>OD (Right)</label>
              <input
                type="number"
                value={baselineIOPOD}
                onChange={(e) => setBaselineIOPOD(parseFloat(e.target.value))}
                min="8"
                max="50"
              />
            </div>
            <div>
              <label>OS (Left)</label>
              <input
                type="number"
                value={baselineIOPOS}
                onChange={(e) => setBaselineIOPOS(parseFloat(e.target.value))}
                min="8"
                max="50"
              />
            </div>
          </div>
        </div>

        {/* Disease Classification */}
        <div className="form-group">
          <label>Disease Stage</label>
          <select value={diseaseStage} onChange={(e) => setDiseaseStage(e.target.value)}>
            <option value="Early">Early</option>
            <option value="Moderate">Moderate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        <div className="form-group">
          <label>Disease Severity</label>
          <select value={diseaseSeverity} onChange={(e) => setDiseaseSeverity(e.target.value)}>
            <option value="Mild">Mild</option>
            <option value="Moderate">Moderate</option>
            <option value="Severe">Severe</option>
          </select>
        </div>

        {/* Risk Factors */}
        <div className="form-group">
          <label>Risk Factors (Select applicable conditions)</label>
          <div className="risk-factors-grid">
            {Object.entries(riskFactorLabels).map(([factor, label]) => (
              <div key={factor} className="risk-factor-item">
                <label>{label}</label>
                <select
                  value={riskFactors[factor]}
                  onChange={(e) => handleRiskFactorChange(factor, e.target.value)}
                >
                  <option value="LOW">Low</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Calculate Button */}
        <button
          onClick={calculateTarget}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Calculating...' : 'Calculate Target IOP'}
        </button>
      </div>

      {/* Results */}
      {calculation && (
        <div className="calculator-results">
          <h3>📊 Calculation Results</h3>
          
          <div className="result-box">
            <h4>Risk Grade: {calculation.calculation.risk_grade}</h4>
            <p>Total Risk Points: {calculation.calculation.total_risk_points}</p>
          </div>

          <div className="results-grid">
            {/* Right Eye */}
            <div className="result-eye">
              <h4>👁️ Right Eye (OD)</h4>
              <div className="result-item">
                <span>Baseline</span>
                <strong>{calculation.calculation.right_eye.baseline_iop} mmHg</strong>
              </div>
              <div className="result-item">
                <span>Target</span>
                <strong className="target-value">{calculation.calculation.right_eye.target} mmHg</strong>
              </div>
              <div className="result-item">
                <span>Range</span>
                <span className="range-value">
                  {calculation.calculation.right_eye.min_target} - {calculation.calculation.right_eye.max_target}
                </span>
              </div>
              <div className="result-item">
                <span>Reduction</span>
                <span>{calculation.calculation.right_eye.reduction_percent}%</span>
              </div>
            </div>

            {/* Left Eye */}
            <div className="result-eye">
              <h4>👁️ Left Eye (OS)</h4>
              <div className="result-item">
                <span>Baseline</span>
                <strong>{calculation.calculation.left_eye.baseline_iop} mmHg</strong>
              </div>
              <div className="result-item">
                <span>Target</span>
                <strong className="target-value">{calculation.calculation.left_eye.target} mmHg</strong>
              </div>
              <div className="result-item">
                <span>Range</span>
                <span className="range-value">
                  {calculation.calculation.left_eye.min_target} - {calculation.calculation.left_eye.max_target}
                </span>
              </div>
              <div className="result-item">
                <span>Reduction</span>
                <span>{calculation.calculation.left_eye.reduction_percent}%</span>
              </div>
            </div>
          </div>

          <div className="recommendation-box">
            <h4>💡 Clinical Recommendation</h4>
            <p>{calculation.calculation.recommendation}</p>
          </div>

          <button
            onClick={saveTarget}
            className="btn btn-success"
          >
            ✓ Save Target Pressure
          </button>
        </div>
      )}
    </div>
  );
};

export default TargetIOPCalculator;
