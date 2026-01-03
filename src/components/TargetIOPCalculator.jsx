import React, { useState, useEffect } from 'react';
import '../styles/TargetIOP.css';

/**
 * TRBS Target IOP Calculator Component - PER EYE
 * Calculates individual target IOP for EACH EYE based on Total Risk Burden Score
 * 
 * 7 Domains:
 * A. Demographic Risk (1-4) - Shared
 * B. Baseline IOP (0-4) - Shared
 * C. Structural Changes (0-9) - Per Eye (CDR + Notching + RNFL + Disc Hemorrhage)
 * D. Functional/Visual Field Changes (0-6) - Per Eye
 * E. Disease/Patient Factors (0-3) - Shared
 * F. Ocular Risk Modifiers (0-8) - Per Eye (CCT + Myopia + others)
 * G. Systemic Risk Modifiers (0-5) - Shared
 * 
 * Total Risk Burden Score = Sum of risk factors + sum of all risk modifiers
 * Risk Tiers: 1-6 Low (20-25%), 7-12 Moderate (30-35%), 13-18 High (40-45%), ≥19 Very High (≥50%)
 */
export const TargetIOPCalculator = ({ patientId, onTargetCalculated }) => {
  // Baseline IOP (first untreated IOP)
  const [baselineIOPOD, setBaselineIOPOD] = useState(null);
  const [baselineIOPOS, setBaselineIOPOS] = useState(null);
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [baselineSource, setBaselineSource] = useState(null);
  
  // Patient data
  const [patientAge, setPatientAge] = useState(null);
  
  // EMR auto-populate state
  const [emrLoading, setEmrLoading] = useState(false);
  const [emrPopulated, setEmrPopulated] = useState(false);
  const [emrRiskFactors, setEmrRiskFactors] = useState(null);
  
  // ========== DOMAIN A: Demographics (Shared) ==========
  const [age, setAge] = useState('50_to_70');
  const [familyHistory, setFamilyHistory] = useState('absent');
  
  // ========== DOMAIN B: Baseline IOP (Shared) ==========
  const [numAGM, setNumAGM] = useState('0');

  // Helper function to get age range from actual age
  const getAgeRange = (actualAge) => {
    if (actualAge < 50) return 'under_50';
    if (actualAge <= 70) return '50_to_70';
    return 'over_70';
  };

  // Fetch EMR risk factors and auto-populate fields
  const fetchAndPopulateFromEMR = async () => {
    if (!patientId) return;
    
    setEmrLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/emr/${patientId}/risk-factors`);
      if (response.ok) {
        const result = await response.json();
        if (result.exists && result.data) {
          const data = result.data;
          setEmrRiskFactors(data);
          
          // Auto-populate Domain A: Demographics
          if (data.age_range) setAge(data.age_range);
          if (data.family_history) setFamilyHistory(data.family_history);
          
          // Auto-populate Domain B: Baseline IOP
          if (data.baseline_iop_od) setBaselineIOPOD(data.baseline_iop_od);
          if (data.baseline_iop_os) setBaselineIOPOS(data.baseline_iop_os);
          if (data.num_agm) setNumAGM(data.num_agm);
          
          // Auto-populate Domain C: Structural (per eye)
          if (data.cdr_od) setCdrOD(data.cdr_od);
          if (data.cdr_os) setCdrOS(data.cdr_os);
          if (data.notching_od) setNotchingOD(data.notching_od);
          if (data.notching_os) setNotchingOS(data.notching_os);
          if (data.rnfl_defect_od) setRnflDefectOD(data.rnfl_defect_od);
          if (data.rnfl_defect_os) setRnflDefectOS(data.rnfl_defect_os);
          if (data.disc_hemorrhage_od) setDiscHemorrhageOD(data.disc_hemorrhage_od);
          if (data.disc_hemorrhage_os) setDiscHemorrhageOS(data.disc_hemorrhage_os);
          
          // Auto-populate Domain D: Functional (per eye)
          if (data.mean_deviation_od) setMeanDeviationOD(data.mean_deviation_od);
          if (data.mean_deviation_os) setMeanDeviationOS(data.mean_deviation_os);
          if (data.central_field_od) setCentralFieldOD(data.central_field_od);
          if (data.central_field_os) setCentralFieldOS(data.central_field_os);
          
          // Auto-populate Domain E: Patient Factors
          if (data.patient_factors) setPatientFactors(data.patient_factors);
          
          // Auto-populate Domain F: Ocular (per eye)
          if (data.cct_od) setCctOD(data.cct_od);
          if (data.cct_os) setCctOS(data.cct_os);
          if (data.myopia_od) setMyopiaOD(data.myopia_od);
          if (data.myopia_os) setMyopiaOS(data.myopia_os);
          if (data.ocular_modifiers_od) setOcularModifiersOD(data.ocular_modifiers_od);
          if (data.ocular_modifiers_os) setOcularModifiersOS(data.ocular_modifiers_os);
          
          // Auto-populate Domain G: Systemic
          if (data.systemic_factors) setSystemicFactors(data.systemic_factors);
          
          setEmrPopulated(true);
          alert('✓ Successfully populated risk factors from EMR data!');
        } else {
          alert('No EMR risk factors found. Please enter data in the EMR sections first.');
        }
      }
    } catch (err) {
      console.error('Error fetching EMR risk factors:', err);
      alert('❌ Error fetching EMR data: ' + err.message);
    } finally {
      setEmrLoading(false);
    }
  };

  // Fetch patient data to auto-set age range
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientId) return;
      
      try {
        const response = await fetch(`http://localhost:8000/api/patients/${patientId}`);
        if (response.ok) {
          const data = await response.json();
          setPatientAge(data.age);
          // Auto-set age range based on patient's actual age
          if (data.age) {
            setAge(getAgeRange(data.age));
          }
        }
      } catch (err) {
        console.error('Error fetching patient data:', err);
      }
    };

    fetchPatientData();
  }, [patientId]);

  // Fetch baseline IOP when component mounts or patientId changes
  useEffect(() => {
    const fetchBaselineIOP = async () => {
      if (!patientId) return;
      
      setBaselineLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/api/measurements/${patientId}/baseline`);
        if (response.ok) {
          const data = await response.json();
          setBaselineIOPOD(data.baseline_iop_od);
          setBaselineIOPOS(data.baseline_iop_os);
          setBaselineSource(data.source);
        } else {
          // Default values if no baseline found
          setBaselineIOPOD(21);
          setBaselineIOPOS(21);
          setBaselineSource('default');
        }
      } catch (err) {
        console.error('Error fetching baseline IOP:', err);
        setBaselineIOPOD(21);
        setBaselineIOPOS(21);
        setBaselineSource('default');
      } finally {
        setBaselineLoading(false);
      }
    };

    fetchBaselineIOP();
  }, [patientId]);
  
  // ========== DOMAIN C: Structural - RIGHT EYE (OD) ==========
  const [cdrOD, setCdrOD] = useState('0.5_or_less');
  const [notchingOD, setNotchingOD] = useState('absent');
  const [rnflDefectOD, setRnflDefectOD] = useState('absent');
  const [discHemorrhageOD, setDiscHemorrhageOD] = useState('absent');
  
  // ========== DOMAIN C: Structural - LEFT EYE (OS) ==========
  const [cdrOS, setCdrOS] = useState('0.5_or_less');
  const [notchingOS, setNotchingOS] = useState('absent');
  const [rnflDefectOS, setRnflDefectOS] = useState('absent');
  const [discHemorrhageOS, setDiscHemorrhageOS] = useState('absent');
  
  // ========== DOMAIN D: Functional - RIGHT EYE (OD) ==========
  const [meanDeviationOD, setMeanDeviationOD] = useState('hfa_not_done');
  const [centralFieldOD, setCentralFieldOD] = useState('no');
  
  // ========== DOMAIN D: Functional - LEFT EYE (OS) ==========
  const [meanDeviationOS, setMeanDeviationOS] = useState('hfa_not_done');
  const [centralFieldOS, setCentralFieldOS] = useState('no');
  
  // ========== DOMAIN E: Patient Factors (Shared) ==========
  const [patientFactors, setPatientFactors] = useState([]);
  
  // ========== DOMAIN F: Ocular - RIGHT EYE (OD) ==========
  const [cctOD, setCctOD] = useState('normal');
  const [myopiaOD, setMyopiaOD] = useState('none');
  const [ocularModifiersOD, setOcularModifiersOD] = useState([]);
  
  // ========== DOMAIN F: Ocular - LEFT EYE (OS) ==========
  const [cctOS, setCctOS] = useState('normal');
  const [myopiaOS, setMyopiaOS] = useState('none');
  const [ocularModifiersOS, setOcularModifiersOS] = useState([]);
  
  // ========== DOMAIN G: Systemic (Shared) ==========
  const [systemicFactors, setSystemicFactors] = useState([]);
  
  // Options
  const [useAggressiveReduction, setUseAggressiveReduction] = useState(false);
  
  // Results
  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Doctor Override - per eye
  const [doctorTargetOD, setDoctorTargetOD] = useState(null);
  const [doctorTargetOS, setDoctorTargetOS] = useState(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isOverriddenOD, setIsOverriddenOD] = useState(false);
  const [isOverriddenOS, setIsOverriddenOS] = useState(false);

  const toggleArrayItem = (array, setArray, item) => {
    if (array.includes(item)) {
      setArray(array.filter(i => i !== item));
    } else {
      setArray([...array, item]);
    }
  };

  const calculateTarget = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build per-eye risk factors
      const riskFactors = {
        // Domain A (shared)
        age,
        family_history: familyHistory,
        // Domain B - Baseline IOP (shared)
        num_agm: numAGM,
        // Domain C - Structural per eye
        cdr_od: cdrOD,
        notching_od: notchingOD,
        rnfl_defect_od: rnflDefectOD,
        disc_hemorrhage_od: discHemorrhageOD,
        cdr_os: cdrOS,
        notching_os: notchingOS,
        rnfl_defect_os: rnflDefectOS,
        disc_hemorrhage_os: discHemorrhageOS,
        // Domain D - Visual Field per eye
        mean_deviation_od: meanDeviationOD,
        central_field_od: centralFieldOD,
        mean_deviation_os: meanDeviationOS,
        central_field_os: centralFieldOS,
        // Domain E - Patient Factors (shared)
        patient_factors: patientFactors,
        // Domain F - Ocular Modifiers per eye
        cct_od: cctOD,
        myopia_od: myopiaOD,
        ocular_modifiers_od: ocularModifiersOD,
        cct_os: cctOS,
        myopia_os: myopiaOS,
        ocular_modifiers_os: ocularModifiersOS,
        // Domain G - Systemic (shared)
        systemic_factors: systemicFactors,
        use_aggressive_reduction: useAggressiveReduction
      };

      const queryParams = new URLSearchParams({
        baseline_iop_od: baselineIOPOD.toString(),
        baseline_iop_os: baselineIOPOS.toString()
      });

      const response = await fetch(
        `http://localhost:8000/api/targets/${patientId}/calculate-trbs?${queryParams.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(riskFactors)
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
      
      // Initialize doctor override fields with calculated values
      const odCalc = data.calculation?.od_result?.calculated_target || data.calculation?.target_iop_od;
      const osCalc = data.calculation?.os_result?.calculated_target || data.calculation?.target_iop_os;
      setDoctorTargetOD(odCalc);
      setDoctorTargetOS(osCalc);
      setIsOverriddenOD(false);
      setIsOverriddenOS(false);
      setDoctorNotes('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveTarget = async () => {
    if (!calculation) return;

    try {
      const odResult = calculation.calculation?.od_result || {};
      const osResult = calculation.calculation?.os_result || {};
      
      // Get calculated values (fallback to legacy format)
      const calcTargetOD = odResult.calculated_target || calculation.calculation?.target_iop_od;
      const calcTargetOS = osResult.calculated_target || calculation.calculation?.target_iop_os;

      // Get glaucoma stage from patient data (via API call to get patient info)
      let glaucomaStageOD = 'EARLY';
      let glaucomaStageOS = 'EARLY';
      let upperCapOD = 18;
      let upperCapOS = 18;
      
      try {
        const patientResponse = await fetch(`http://localhost:8000/api/patients/${patientId}`);
        if (patientResponse.ok) {
          const patientData = await patientResponse.json();
          glaucomaStageOD = patientData.glaucoma_stage_od || 'EARLY';
          glaucomaStageOS = patientData.glaucoma_stage_os || 'EARLY';
          
          // Determine upper cap based on stage
          const getUpperCap = (stage) => {
            switch(stage) {
              case 'EARLY': return 18;
              case 'NORMAL_TENSION': return 16;
              case 'ADVANCED': return 14;
              case 'END_STAGE': return 12;
              default: return 18;
            }
          };
          upperCapOD = getUpperCap(glaucomaStageOD);
          upperCapOS = getUpperCap(glaucomaStageOS);
        }
      } catch (err) {
        console.log('Could not fetch patient data for glaucoma stage:', err);
      }
      
      const queryParams = new URLSearchParams({
        calculated_target_od: calcTargetOD.toString(),
        calculated_target_os: calcTargetOS.toString(),
        final_target_od: doctorTargetOD.toString(),
        final_target_os: doctorTargetOS.toString(),
        override_reason: doctorNotes || '',
        trbs_score_od: (odResult.trbs_score || calculation.calculation?.trbs_score || 0).toString(),
        trbs_score_os: (osResult.trbs_score || calculation.calculation?.trbs_score || 0).toString(),
        risk_tier_od: odResult.risk_tier || calculation.calculation?.risk_tier || '',
        risk_tier_os: osResult.risk_tier || calculation.calculation?.risk_tier || '',
        glaucoma_stage_od: glaucomaStageOD,
        glaucoma_stage_os: glaucomaStageOS,
        upper_cap_od: upperCapOD.toString(),
        upper_cap_os: upperCapOS.toString(),
        baseline_iop_od: baselineIOPOD.toString(),
        baseline_iop_os: baselineIOPOS.toString(),
        reduction_percentage_od: (odResult.reduction_applied || calculation.calculation?.reduction_percentage_min || 0).toString(),
        reduction_percentage_os: (osResult.reduction_applied || calculation.calculation?.reduction_percentage_min || 0).toString(),
        set_by: 'Ophthalmologist'
      });

      const response = await fetch(
        `http://localhost:8000/api/targets/${patientId}/save-with-override?${queryParams.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save error:', response.status, errorText);
        throw new Error(`Failed to save target (${response.status})`);
      }

      const result = await response.json();
      alert('✓ Target IOP saved successfully!');
      
      if (onTargetCalculated) {
        onTargetCalculated({
          target_iop_od: doctorTargetOD,
          target_iop_os: doctorTargetOS,
          ...result
        });
      }
    } catch (err) {
      console.error('Error in saveTarget:', err);
      alert('❌ Error saving target: ' + err.message);
    }
  };

  const getRiskTierColor = (tier) => {
    switch (tier) {
      case 'Low': return '#22c55e';
      case 'Moderate': return '#eab308';
      case 'High': return '#f97316';
      case 'Very High': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="card target-iop-calculator per-eye">
      <div className="calculator-header">
        <h2>🎯 Target IOP Calculator (TRBS) - Per Eye</h2>
        <button 
          className={`emr-populate-btn ${emrPopulated ? 'populated' : ''}`}
          onClick={fetchAndPopulateFromEMR}
          disabled={emrLoading || !patientId}
          title="Auto-populate risk factors from EMR data"
        >
          {emrLoading ? '⏳ Loading...' : emrPopulated ? '✓ EMR Loaded' : '📥 Auto-populate from EMR'}
        </button>
      </div>
      <p className="info-text">
        Calculates individualized target IOP for <strong>EACH EYE</strong> based on Total Risk Burden Score 
        and reduction percentages based on risk tier.
        {emrPopulated && <span className="emr-notice"> ✓ Risk factors loaded from EMR</span>}
      </p>

      {error && <div className="error-message">❌ {error}</div>}

      <div className="calculator-section">
        {/* ========== BASELINE IOP ========== */}
        <div className="domain-section">
          <h3>📊 Baseline IOP (First Untreated IOP)</h3>
          {baselineLoading ? (
            <div className="loading-baseline">Loading baseline IOP...</div>
          ) : (
            <>
              {baselineSource && (
                <div className={`baseline-source ${baselineSource === 'default' ? 'warning' : 'info'}`}>
                  {baselineSource === 'stored_baseline' && '✓ Using stored baseline (first untreated IOP)'}
                  {baselineSource === 'first_measurement' && '✓ Using first recorded measurement as baseline'}
                  {baselineSource === 'default' && '⚠️ No baseline found - using default values. Please set correct baseline.'}
                </div>
              )}
              <div className="eye-grid">
                <div className="form-group">
                  <label>IOP OD (Right Eye) - Untreated</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={baselineIOPOD || ''}
                      onChange={(e) => setBaselineIOPOD(parseFloat(e.target.value) || 0)}
                      min="8"
                      max="60"
                      step="0.5"
                    />
                    <span className="unit">mmHg</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>IOP OS (Left Eye) - Untreated</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={baselineIOPOS || ''}
                      onChange={(e) => setBaselineIOPOS(parseFloat(e.target.value) || 0)}
                      min="8"
                      max="60"
                      step="0.5"
                    />
                    <span className="unit">mmHg</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ========== DOMAIN A: Demographics (Shared) ========== */}
        <div className="domain-section">
          <h3>A. Demographic Risk <span className="score-range">(0-4 pts) - Shared for both eyes</span></h3>
          <div className="form-row two-col">
            <div className="form-group">
              <label>
                Age Range 
                {patientAge && (
                  <span className="auto-detected-badge">
                    (Patient Age: {patientAge} years - Auto-detected)
                  </span>
                )}
              </label>
              <select value={age} onChange={(e) => setAge(e.target.value)}>
                <option value="over_70">&gt;70 years (1 pt)</option>
                <option value="50_to_70">50-70 years (2 pts)</option>
                <option value="under_50">&lt;50 years (3 pts)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Family History (1st degree)</label>
              <select value={familyHistory} onChange={(e) => setFamilyHistory(e.target.value)}>
                <option value="absent">Absent (0 pts)</option>
                <option value="present">Present (1 pt)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Domain B: Baseline IOP - Auto-populated from Complaints section */}
        {/* AGM adjustment is already calculated in Complaints when baseline is captured */}

        {/* ========== DOMAIN C: Structural (Per Eye) ========== */}
        <div className="domain-section">
          <h3>C. Structural Changes <span className="score-range">(0-9 pts) - Per Eye</span></h3>
          <div className="eye-grid">
            {/* RIGHT EYE (OD) */}
            <div className="eye-section">
              <h4 className="eye-title od">👁️ Right Eye (OD)</h4>
              <div className="form-group">
                <label>Vertical CDR</label>
                <select value={cdrOD} onChange={(e) => setCdrOD(e.target.value)}>
                  <option value="0.5_or_less">≤0.5 (0 pts)</option>
                  <option value="0.6">0.6 (1 pt)</option>
                  <option value="0.7">0.7 (2 pts)</option>
                  <option value="0.8">0.8 (3 pts)</option>
                  <option value="0.9_or_more">≥0.9 (4 pts)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Focal Notching</label>
                <select value={notchingOD} onChange={(e) => setNotchingOD(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="unipolar">Unipolar (2 pts)</option>
                  <option value="bipolar">Bipolar (3 pts)</option>
                </select>
              </div>
              <div className="form-group">
                <label>RNFL Defect</label>
                <select value={rnflDefectOD} onChange={(e) => setRnflDefectOD(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="present">Present (1 pt)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Disc Hemorrhage</label>
                <select value={discHemorrhageOD} onChange={(e) => setDiscHemorrhageOD(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="present">Present (1 pt)</option>
                </select>
              </div>
            </div>
            {/* LEFT EYE (OS) */}
            <div className="eye-section">
              <h4 className="eye-title os">👁️ Left Eye (OS)</h4>
              <div className="form-group">
                <label>Vertical CDR</label>
                <select value={cdrOS} onChange={(e) => setCdrOS(e.target.value)}>
                  <option value="0.5_or_less">≤0.5 (0 pts)</option>
                  <option value="0.6">0.6 (1 pt)</option>
                  <option value="0.7">0.7 (2 pts)</option>
                  <option value="0.8">0.8 (3 pts)</option>
                  <option value="0.9_or_more">≥0.9 (4 pts)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Focal Notching</label>
                <select value={notchingOS} onChange={(e) => setNotchingOS(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="unipolar">Unipolar (2 pts)</option>
                  <option value="bipolar">Bipolar (3 pts)</option>
                </select>
              </div>
              <div className="form-group">
                <label>RNFL Defect</label>
                <select value={rnflDefectOS} onChange={(e) => setRnflDefectOS(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="present">Present (1 pt)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Disc Hemorrhage</label>
                <select value={discHemorrhageOS} onChange={(e) => setDiscHemorrhageOS(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="present">Present (1 pt)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ========== DOMAIN D: Functional (Per Eye) ========== */}
        <div className="domain-section">
          <h3>D. Functional / Visual Field <span className="score-range">(0-6 pts) - Per Eye</span></h3>
          <div className="eye-grid">
            {/* RIGHT EYE (OD) */}
            <div className="eye-section">
              <h4 className="eye-title od">👁️ Right Eye (OD)</h4>
              <div className="form-group">
                <label>Mean Deviation (MD)</label>
                <select value={meanDeviationOD} onChange={(e) => setMeanDeviationOD(e.target.value)}>
                  <option value="hfa_not_done">HFA not done in first visit (0 pts)</option>
                  <option value="greater_than_minus_6">&gt;-6 dB (1 pt)</option>
                  <option value="minus_6_to_minus_12">-6 to -12 dB (2 pts)</option>
                  <option value="minus_12_to_minus_20">-12 to -20 dB (3 pts)</option>
                  <option value="less_than_minus_20">&lt;-20 dB (4 pts)</option>
                  <option value="hfa_not_possible">HFA not possible due to advanced disease (4 pts)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Central Field Involvement (5 degrees)</label>
                <select value={centralFieldOD} onChange={(e) => setCentralFieldOD(e.target.value)}>
                  <option value="no">No (0 pts)</option>
                  <option value="yes">Yes (2 pts)</option>
                </select>
              </div>
            </div>
            {/* LEFT EYE (OS) */}
            <div className="eye-section">
              <h4 className="eye-title os">👁️ Left Eye (OS)</h4>
              <div className="form-group">
                <label>Mean Deviation (MD)</label>
                <select value={meanDeviationOS} onChange={(e) => setMeanDeviationOS(e.target.value)}>
                  <option value="hfa_not_done">HFA not done in first visit (0 pts)</option>
                  <option value="greater_than_minus_6">&gt;-6 dB (1 pt)</option>
                  <option value="minus_6_to_minus_12">-6 to -12 dB (2 pts)</option>
                  <option value="minus_12_to_minus_20">-12 to -20 dB (3 pts)</option>
                  <option value="less_than_minus_20">&lt;-20 dB (4 pts)</option>
                  <option value="hfa_not_possible">HFA not possible due to advanced disease (4 pts)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Central Field Involvement (5 degrees)</label>
                <select value={centralFieldOS} onChange={(e) => setCentralFieldOS(e.target.value)}>
                  <option value="no">No (0 pts)</option>
                  <option value="yes">Yes (2 pts)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ========== DOMAIN E: Disease/Patient Factors (Shared) ========== */}
        <div className="domain-section">
          <h3>E. Disease / Patient Factors <span className="score-range">(0-3 pts) - Shared for both eyes</span></h3>
          <div className="checkbox-group">
            {[
              { key: 'one_eyed_or_advanced_fellow', label: 'One-Eyed Patient / Advanced Disease in Fellow Eye (+2)' },
              { key: 'poor_compliance', label: 'Poor Compliance / Follow-up (+1)' }
            ].map(item => (
              <label key={item.key} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={patientFactors.includes(item.key)}
                  onChange={() => toggleArrayItem(patientFactors, setPatientFactors, item.key)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ========== DOMAIN F: Ocular (Per Eye) ========== */}
        <div className="domain-section">
          <h3>F. Ocular Risk Modifiers <span className="score-range">(0-8 pts) - Per Eye</span></h3>
          <div className="eye-grid">
            {/* RIGHT EYE (OD) */}
            <div className="eye-section">
              <h4 className="eye-title od">👁️ Right Eye (OD)</h4>
              <div className="form-group">
                <label>Central Corneal Thickness (CCT)</label>
                <select value={cctOD} onChange={(e) => setCctOD(e.target.value)}>
                  <option value="normal">≥500 µm (0 pts)</option>
                  <option value="thin">&lt;500 µm (+1 pt)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Myopia (without cataract)</label>
                <select value={myopiaOD} onChange={(e) => setMyopiaOD(e.target.value)}>
                  <option value="none">None / With Cataract (0 pts)</option>
                  <option value="low_myopia">Low Myopia (-1DS to -3DS) (+1 pt)</option>
                  <option value="mod_high_myopia">Mod to High Myopia (&lt;-3DS) (+2 pts)</option>
                </select>
              </div>
              <div className="checkbox-group compact">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={ocularModifiersOD.includes('angle_recession')}
                    onChange={() => toggleArrayItem(ocularModifiersOD, setOcularModifiersOD, 'angle_recession')}
                  />
                  <span>Angle Recession &gt;180° (+1)</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={ocularModifiersOD.includes('pseudoexfoliation')}
                    onChange={() => toggleArrayItem(ocularModifiersOD, setOcularModifiersOD, 'pseudoexfoliation')}
                  />
                  <span>Pseudoexfoliation (+1)</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={ocularModifiersOD.includes('pigment_dispersion')}
                    onChange={() => toggleArrayItem(ocularModifiersOD, setOcularModifiersOD, 'pigment_dispersion')}
                  />
                  <span>Pigment Dispersion (+1)</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={ocularModifiersOD.includes('steroid_responder')}
                    onChange={() => toggleArrayItem(ocularModifiersOD, setOcularModifiersOD, 'steroid_responder')}
                  />
                  <span>Steroid Responder (+1)</span>
                </label>
              </div>
            </div>
            {/* LEFT EYE (OS) */}
            <div className="eye-section">
              <h4 className="eye-title os">👁️ Left Eye (OS)</h4>
              <div className="form-group">
                <label>Central Corneal Thickness (CCT)</label>
                <select value={cctOS} onChange={(e) => setCctOS(e.target.value)}>
                  <option value="normal">≥500 µm (0 pts)</option>
                  <option value="thin">&lt;500 µm (+1 pt)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Myopia (without cataract)</label>
                <select value={myopiaOS} onChange={(e) => setMyopiaOS(e.target.value)}>
                  <option value="none">None / With Cataract (0 pts)</option>
                  <option value="low_myopia">Low Myopia (-1DS to -3DS) (+1 pt)</option>
                  <option value="mod_high_myopia">Mod to High Myopia (&lt;-3DS) (+2 pts)</option>
                </select>
              </div>
              <div className="checkbox-group compact">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={ocularModifiersOS.includes('angle_recession')}
                    onChange={() => toggleArrayItem(ocularModifiersOS, setOcularModifiersOS, 'angle_recession')}
                  />
                  <span>Angle Recession &gt;180° (+1)</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={ocularModifiersOS.includes('pseudoexfoliation')}
                    onChange={() => toggleArrayItem(ocularModifiersOS, setOcularModifiersOS, 'pseudoexfoliation')}
                  />
                  <span>Pseudoexfoliation (+1)</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={ocularModifiersOS.includes('pigment_dispersion')}
                    onChange={() => toggleArrayItem(ocularModifiersOS, setOcularModifiersOS, 'pigment_dispersion')}
                  />
                  <span>Pigment Dispersion (+1)</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={ocularModifiersOS.includes('steroid_responder')}
                    onChange={() => toggleArrayItem(ocularModifiersOS, setOcularModifiersOS, 'steroid_responder')}
                  />
                  <span>Steroid Responder (+1)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ========== DOMAIN G: Systemic (Shared) ========== */}
        <div className="domain-section">
          <h3>G. Systemic Risk Modifiers <span className="score-range">(0-5 pts) - Shared for both eyes</span></h3>
          <div className="checkbox-group">
            {[
              { key: 'low_ocular_perfusion', label: 'Low Ocular Perfusion Pressure (DOPP <50mm Hg) (+1)' },
              { key: 'migraine_vasospasm', label: 'Migraine / Vasospasm (+1)' },
              { key: 'raynauds', label: "Raynaud's Phenomenon (+1)" },
              { key: 'sleep_apnea', label: 'Sleep Apnea (+1)' },
              { key: 'diabetes_mellitus', label: 'Diabetes Mellitus (+1)' }
            ].map(item => (
              <label key={item.key} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={systemicFactors.includes(item.key)}
                  onChange={() => toggleArrayItem(systemicFactors, setSystemicFactors, item.key)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="domain-section options-section">
          <label className="checkbox-item aggressive-option">
            <input
              type="checkbox"
              checked={useAggressiveReduction}
              onChange={(e) => setUseAggressiveReduction(e.target.checked)}
            />
            <span>⚡ Use Aggressive Reduction (upper range of tier)</span>
          </label>
        </div>

        {/* Calculate Button */}
        <button
          onClick={calculateTarget}
          disabled={loading}
          className="btn btn-primary calculate-btn"
        >
          {loading ? '⏳ Calculating...' : '🎯 Calculate Target IOP (Per Eye)'}
        </button>
      </div>

      {/* ========== RESULTS ========== */}
      {calculation && (
        <div className="calculator-results per-eye-results">
          <h3>📊 Calculation Results</h3>
          
          {/* Per-Eye Results Grid */}
          <div className="per-eye-results-grid">
            {/* RIGHT EYE (OD) */}
            <div className="eye-result-card od">
              <h4>👁️ Right Eye (OD)</h4>
              <div className="result-details">
                <div className="result-row">
                  <span>TRBS Score:</span>
                  <strong>{calculation.per_eye_summary?.od?.trbs_score || calculation.calculation?.od_result?.trbs_score || calculation.calculation?.trbs_score || 'N/A'}/25</strong>
                </div>
                <div className="result-row">
                  <span>Risk Tier:</span>
                  <strong style={{ color: getRiskTierColor(calculation.per_eye_summary?.od?.risk_tier || calculation.calculation?.od_result?.risk_tier || calculation.calculation?.risk_tier) }}>
                    {calculation.per_eye_summary?.od?.risk_tier || calculation.calculation?.od_result?.risk_tier || calculation.calculation?.risk_tier || 'N/A'}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Reduction Applied:</span>
                  <strong>{calculation.per_eye_summary?.od?.reduction_applied || calculation.calculation?.od_result?.reduction_applied || calculation.calculation?.reduction_percentage_min || 'N/A'}%</strong>
                </div>
                <div className="result-row baseline">
                  <span>Baseline IOP:</span>
                  <strong>{baselineIOPOD} mmHg</strong>
                </div>
                <div className="result-row target">
                  <span>🎯 Calculated Target:</span>
                  <strong className="target-value">
                    {calculation.per_eye_summary?.od?.calculated_target || calculation.calculation?.od_result?.calculated_target || calculation.calculation?.target_iop_od} mmHg
                  </strong>
                </div>
              </div>
            </div>

            {/* LEFT EYE (OS) */}
            <div className="eye-result-card os">
              <h4>👁️ Left Eye (OS)</h4>
              <div className="result-details">
                <div className="result-row">
                  <span>TRBS Score:</span>
                  <strong>{calculation.per_eye_summary?.os?.trbs_score || calculation.calculation?.os_result?.trbs_score || calculation.calculation?.trbs_score || 'N/A'}/25</strong>
                </div>
                <div className="result-row">
                  <span>Risk Tier:</span>
                  <strong style={{ color: getRiskTierColor(calculation.per_eye_summary?.os?.risk_tier || calculation.calculation?.os_result?.risk_tier || calculation.calculation?.risk_tier) }}>
                    {calculation.per_eye_summary?.os?.risk_tier || calculation.calculation?.os_result?.risk_tier || calculation.calculation?.risk_tier || 'N/A'}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Reduction Applied:</span>
                  <strong>{calculation.per_eye_summary?.os?.reduction_applied || calculation.calculation?.os_result?.reduction_applied || calculation.calculation?.reduction_percentage_min || 'N/A'}%</strong>
                </div>
                <div className="result-row baseline">
                  <span>Baseline IOP:</span>
                  <strong>{baselineIOPOS} mmHg</strong>
                </div>
                <div className="result-row target">
                  <span>🎯 Calculated Target:</span>
                  <strong className="target-value">
                    {calculation.per_eye_summary?.os?.calculated_target || calculation.calculation?.os_result?.calculated_target || calculation.calculation?.target_iop_os} mmHg
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Doctor Override Section */}
          <div className="doctor-override-section">
            <h4>👨‍⚕️ Doctor Confirmation / Override</h4>
            <p className="override-info">
              Review calculated targets. Modify values if clinically necessary. Override requires reason.
            </p>
            
            <div className="override-grid">
              {/* OD Override */}
              <div className="override-eye od">
                <label>Final Target OD (mmHg)</label>
                <div className="override-input-wrapper">
                  <input
                    type="number"
                    value={doctorTargetOD || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setDoctorTargetOD(val);
                      const calcVal = calculation.per_eye_summary?.od?.calculated_target || 
                                      calculation.calculation?.od_result?.calculated_target || 
                                      calculation.calculation?.target_iop_od;
                      setIsOverriddenOD(Math.abs(val - calcVal) > 0.1);
                    }}
                    min="6"
                    max="25"
                    step="0.5"
                    className={isOverriddenOD ? 'overridden' : ''}
                  />
                  <span className="unit">mmHg</span>
                </div>
                {isOverriddenOD && <span className="override-badge">⚠️ Modified</span>}
              </div>
              
              {/* OS Override */}
              <div className="override-eye os">
                <label>Final Target OS (mmHg)</label>
                <div className="override-input-wrapper">
                  <input
                    type="number"
                    value={doctorTargetOS || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setDoctorTargetOS(val);
                      const calcVal = calculation.per_eye_summary?.os?.calculated_target || 
                                      calculation.calculation?.os_result?.calculated_target || 
                                      calculation.calculation?.target_iop_os;
                      setIsOverriddenOS(Math.abs(val - calcVal) > 0.1);
                    }}
                    min="6"
                    max="25"
                    step="0.5"
                    className={isOverriddenOS ? 'overridden' : ''}
                  />
                  <span className="unit">mmHg</span>
                </div>
                {isOverriddenOS && <span className="override-badge">⚠️ Modified</span>}
              </div>
            </div>

            {/* Override Notes - Required if modified */}
            {(isOverriddenOD || isOverriddenOS) && (
              <div className="override-notes">
                <label>📝 Reason for Override <span className="required">(Required)</span></label>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Clinical reasoning for modifying the calculated target..."
                  rows="3"
                  required
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => {
                const odCalc = calculation.per_eye_summary?.od?.calculated_target || 
                               calculation.calculation?.od_result?.calculated_target ||
                               calculation.calculation?.target_iop_od;
                const osCalc = calculation.per_eye_summary?.os?.calculated_target || 
                               calculation.calculation?.os_result?.calculated_target ||
                               calculation.calculation?.target_iop_os;
                setDoctorTargetOD(odCalc);
                setDoctorTargetOS(osCalc);
                setIsOverriddenOD(false);
                setIsOverriddenOS(false);
                setDoctorNotes('');
              }}
              className="btn btn-secondary"
            >
              ↺ Reset to Calculated
            </button>
            <button
              onClick={saveTarget}
              className="btn btn-success"
              disabled={(isOverriddenOD || isOverriddenOS) && !doctorNotes.trim()}
            >
              {(isOverriddenOD || isOverriddenOS) ? '✓ Save with Override' : '✓ Approve & Save Target'}
            </button>
          </div>

          {/* Reference Tables */}
          <div className="reference-tables">
            <div className="reference-table">
              <h5>📋 Risk Tiers (TRBS Score → Reduction %)</h5>
              <table>
                <thead>
                  <tr><th>Score</th><th>Tier</th><th>Reduction</th><th>Reference</th></tr>
                </thead>
                <tbody>
                  <tr><td>1-6</td><td style={{color: '#22c55e'}}>Low</td><td>20-25%</td><td>EMGT/OHTS</td></tr>
                  <tr><td>7-12</td><td style={{color: '#eab308'}}>Moderate</td><td>30-35%</td><td>CNGTS</td></tr>
                  <tr><td>13-18</td><td style={{color: '#f97316'}}>High</td><td>40-45%</td><td>AGIS</td></tr>
                  <tr><td>≥19</td><td style={{color: '#ef4444'}}>Very High</td><td>≥50%</td><td>Aim ≤12 mmHg</td></tr>
                </tbody>
              </table>
            </div>
            <div className="reference-table">
              <h5>📋 Upper Cap (When Baseline &gt;30mmHg)</h5>
              <table>
                <thead>
                  <tr><th>Vertical CDR</th><th>Max Target IOP</th></tr>
                </thead>
                <tbody>
                  <tr><td>≤0.5</td><td>≤18 mmHg</td></tr>
                  <tr><td>0.6</td><td>16-18 mmHg</td></tr>
                  <tr><td>0.7</td><td>14-16 mmHg</td></tr>
                  <tr><td>0.8</td><td>12-14 mmHg</td></tr>
                  <tr><td>≥0.9</td><td>≤12 mmHg</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetIOPCalculator;
