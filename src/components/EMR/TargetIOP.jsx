
import React, { useState, useEffect } from 'react';
import { AlertTriangle, BarChart3, Clipboard } from 'lucide-react';
import './TargetIOP.css';

/**
 * TRBS Target IOP Calculator Component - Per Eye
 * Matches EMR UI Design Pattern
 */
export default function TargetIOP({ patientId, onTargetCalculated }) {
  // Baseline IOP (first untreated IOP)
  const [baselineIOPOD, setBaselineIOPOD] = useState(21);
  const [baselineIOPOS, setBaselineIOPOS] = useState(21);
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [baselineSource, setBaselineSource] = useState(null);
  
  // Patient data
  const [patientAge, setPatientAge] = useState(null);
  
  // EMR auto-populate state
  const [emrLoading, setEmrLoading] = useState(false);
  const [emrPopulated, setEmrPopulated] = useState(false);
  const [emrRiskFactors, setEmrRiskFactors] = useState(null); // Store all EMR risk factors including dopp_info
  
  // Target status
  const [hasTarget, setHasTarget] = useState(false);
  const [currentTarget, setCurrentTarget] = useState(null);
  
  // ========== DOMAIN A: Demographics (Shared) ==========
  const [age, setAge] = useState('50_to_70');
  const [familyHistory, setFamilyHistory] = useState('absent');
  
  // ========== DOMAIN B: Baseline IOP (Shared) ==========
  const [numAGM, setNumAGM] = useState('0');
  
  // ========== DOMAIN C: Structural - Per Eye ==========
  const [cdrOD, setCdrOD] = useState('0.5_or_less');
  const [notchingOD, setNotchingOD] = useState('absent');
  const [rnflDefectOD, setRnflDefectOD] = useState('absent');
  const [discHemorrhageOD, setDiscHemorrhageOD] = useState('absent');
  const [cdrOS, setCdrOS] = useState('0.5_or_less');
  const [notchingOS, setNotchingOS] = useState('absent');
  const [rnflDefectOS, setRnflDefectOS] = useState('absent');
  const [discHemorrhageOS, setDiscHemorrhageOS] = useState('absent');
  
  // ========== DOMAIN D: Functional - Per Eye ==========
  const [meanDeviationOD, setMeanDeviationOD] = useState('hfa_not_done');
  const [centralFieldOD, setCentralFieldOD] = useState('no');
  const [meanDeviationOS, setMeanDeviationOS] = useState('hfa_not_done');
  const [centralFieldOS, setCentralFieldOS] = useState('no');
  
  // ========== DOMAIN E: Patient Factors (Shared) ==========
  const [patientFactors, setPatientFactors] = useState([]);
  
  // ========== DOMAIN F: Ocular - Per Eye ==========
  const [cctOD, setCctOD] = useState('normal');
  const [myopiaOD, setMyopiaOD] = useState('none');
  const [ocularModifiersOD, setOcularModifiersOD] = useState([]);
  const [cctOS, setCctOS] = useState('normal');
  const [myopiaOS, setMyopiaOS] = useState('none');
  const [ocularModifiersOS, setOcularModifiersOS] = useState([]);
  
  // ========== DOMAIN G: Systemic (Shared) ==========
  const [systemicFactors, setSystemicFactors] = useState([]);
  
  // Options - Always use aggressive reduction (upper range) by default
  const [useAggressiveReduction] = useState(true);
  
  // Results
  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Doctor Override
  const [doctorTargetOD, setDoctorTargetOD] = useState(null);
  const [doctorTargetOS, setDoctorTargetOS] = useState(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isOverriddenOD, setIsOverriddenOD] = useState(false);
  const [isOverriddenOS, setIsOverriddenOS] = useState(false);

  const getAgeRange = (actualAge) => {
    if (actualAge < 50) return 'under_50';
    if (actualAge <= 70) return '50_to_70';
    return 'over_70';
  };

  // Fetch EMR risk factors
  const fetchAndPopulateFromEMR = async () => {
    if (!patientId) return;
    setEmrLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/emr/${patientId}/risk-factors`);
      if (response.ok) {
        const result = await response.json();
        if (result.exists && result.data) {
          const data = result.data;
          setEmrRiskFactors(data); // Store all data for conditional rendering
          
          console.log('📊 Fetched EMR Risk Factors:', data);
          
          if (data.age_range) setAge(data.age_range);
          if (data.family_history) setFamilyHistory(data.family_history);
          if (data.baseline_iop_od) setBaselineIOPOD(data.baseline_iop_od);
          if (data.baseline_iop_os) setBaselineIOPOS(data.baseline_iop_os);
          if (data.num_agm) setNumAGM(data.num_agm);
          if (data.cdr_od) setCdrOD(data.cdr_od);
          if (data.cdr_os) setCdrOS(data.cdr_os);
          if (data.notching_od) setNotchingOD(data.notching_od);
          if (data.notching_os) setNotchingOS(data.notching_os);
          if (data.disc_hemorrhage_od) setDiscHemorrhageOD(data.disc_hemorrhage_od);
          if (data.disc_hemorrhage_os) setDiscHemorrhageOS(data.disc_hemorrhage_os);
          // RNFL Defect
          if (data.rnfl_defect_od) {
            console.log('✓ Setting RNFL Defect OD:', data.rnfl_defect_od);
            setRnflDefectOD(data.rnfl_defect_od);
          }
          if (data.rnfl_defect_os) {
            console.log('✓ Setting RNFL Defect OS:', data.rnfl_defect_os);
            setRnflDefectOS(data.rnfl_defect_os);
          }
          // Auto-populate Domain D: Functional (per eye)
          // Map mean_deviation from stored format to calculator format
          if (data.mean_deviation_od) {
            const mdMap = {
              '0_to_minus_6': 'greater_than_minus_6',
              'minus_6_to_minus_12': 'minus_6_to_minus_12',
              'less_than_minus_12': 'less_than_minus_20',
              'hfa_not_done': 'hfa_not_done'
            };
            setMeanDeviationOD(mdMap[data.mean_deviation_od] || data.mean_deviation_od || 'hfa_not_done');
          } else {
            setMeanDeviationOD('hfa_not_done');
          }
          if (data.mean_deviation_os) {
            const mdMap = {
              '0_to_minus_6': 'greater_than_minus_6',
              'minus_6_to_minus_12': 'minus_6_to_minus_12',
              'less_than_minus_12': 'less_than_minus_20',
              'hfa_not_done': 'hfa_not_done'
            };
            setMeanDeviationOS(mdMap[data.mean_deviation_os] || data.mean_deviation_os || 'hfa_not_done');
          } else {
            setMeanDeviationOS('hfa_not_done');
          }
          if (data.central_field_od) setCentralFieldOD(data.central_field_od);
          if (data.central_field_os) setCentralFieldOS(data.central_field_os);
          // Auto-populate Domain E: Patient Factors
          if (data.patient_factors) setPatientFactors(data.patient_factors);
          
          // Auto-populate Domain F: Ocular (per eye)
          if (data.cct_od) {
            console.log('✓ Setting CCT OD:', data.cct_od);
            setCctOD(data.cct_od);
          }
          if (data.cct_os) {
            console.log('✓ Setting CCT OS:', data.cct_os);
            setCctOS(data.cct_os);
          }
          if (data.myopia_od) {
            console.log('✓ Setting Myopia OD:', data.myopia_od);
            setMyopiaOD(data.myopia_od);
          }
          if (data.myopia_os) {
            console.log('✓ Setting Myopia OS:', data.myopia_os);
            setMyopiaOS(data.myopia_os);
          }
          if (data.ocular_modifiers_od) setOcularModifiersOD(data.ocular_modifiers_od);
          if (data.ocular_modifiers_os) setOcularModifiersOS(data.ocular_modifiers_os);
          
          // Auto-populate Domain G: Systemic (includes BP-derived low_ocular_perfusion)
          let finalSystemicFactors = data.systemic_factors || [];
          
          // Check dopp_info and add low_ocular_perfusion if DOPP < 50
          if (data.dopp_info) {
            const dopp = data.dopp_info;
            console.log('📊 BP/DOPP Info received:', dopp);
            
            if (dopp.low_perfusion_od || dopp.low_perfusion_os) {
              console.log(`⚠️ Low DOPP detected: OD=${dopp.dopp_od}mmHg, OS=${dopp.dopp_os}mmHg (BP: ${dopp.bp_value}, Diastolic: ${dopp.diastolic}mmHg)`);
              
              // Ensure low_ocular_perfusion is in systemic_factors if DOPP is low
              if (!finalSystemicFactors.includes('low_ocular_perfusion')) {
                finalSystemicFactors = [...finalSystemicFactors, 'low_ocular_perfusion'];
                console.log('✓ Added low_ocular_perfusion to systemic_factors based on DOPP calculation');
              }
            } else {
              console.log(`✓ DOPP normal: OD=${dopp.dopp_od}mmHg, OS=${dopp.dopp_os}mmHg (BP: ${dopp.bp_value}, Diastolic: ${dopp.diastolic}mmHg)`);
              
              // Remove low_ocular_perfusion if DOPP is no longer low
              if (finalSystemicFactors.includes('low_ocular_perfusion')) {
                finalSystemicFactors = finalSystemicFactors.filter(f => f !== 'low_ocular_perfusion');
                console.log('✓ Removed low_ocular_perfusion from systemic_factors (DOPP is now normal)');
              }
            }
          } else {
            console.log('ℹ️ No BP/DOPP info available. Make sure BP is entered in Investigation section and IOP measurements exist.');
          }
          
          // Set the final systemic factors
          if (finalSystemicFactors.length > 0) {
            setSystemicFactors(finalSystemicFactors);
            if (finalSystemicFactors.includes('low_ocular_perfusion')) {
              console.log('✓ Low Ocular Perfusion Pressure will be checked in calculator');
            }
          }
          
          setEmrPopulated(true);
          
          // Log what was populated for debugging
          console.log('✅ Auto-populated values:', {
            rnfl_od: data.rnfl_defect_od || 'not set',
            rnfl_os: data.rnfl_defect_os || 'not set',
            cct_od: data.cct_od || 'not set',
            cct_os: data.cct_os || 'not set',
            myopia_od: data.myopia_od || 'not set',
            myopia_os: data.myopia_os || 'not set'
          });
        } else {
          console.warn('⚠️ No EMR risk data found');
        }
      } else {
        console.error('⚠️ Error response from API');
      }
    } catch (err) {
      console.error('Error fetching EMR risk factors:', err);
    } finally {
      setEmrLoading(false);
    }
  };

  // Auto-fetch EMR data on mount
  useEffect(() => {
    if (patientId) {
      fetchAndPopulateFromEMR();
    }
  }, [patientId]);

  // Fetch patient data
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientId) return;
      try {
        const response = await fetch(`http://localhost:8000/api/patients/${patientId}`);
        if (response.ok) {
          const data = await response.json();
          setPatientAge(data.age);
          if (data.age) setAge(getAgeRange(data.age));
        }
      } catch (err) {
        console.error('Error fetching patient data:', err);
      }
    };
    fetchPatientData();
  }, [patientId]);

  // Fetch baseline IOP
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
          setBaselineIOPOD(21);
          setBaselineIOPOS(21);
          setBaselineSource('default');
        }
      } catch (err) {
        setBaselineIOPOD(21);
        setBaselineIOPOS(21);
        setBaselineSource('default');
      } finally {
        setBaselineLoading(false);
      }
    };
    fetchBaselineIOP();
  }, [patientId]);

  // Check for existing target
  useEffect(() => {
    const checkExistingTarget = async () => {
      if (!patientId) return;
      try {
        const response = await fetch(`http://localhost:8000/api/targets/${patientId}/current`);
        if (response.ok) {
          const data = await response.json();
          // Check if target exists (new format has exists flag)
          if (data && data.exists !== false && data.target_iop_od) {
            setHasTarget(true);
            setCurrentTarget(data);
          } else {
            setHasTarget(false);
            setCurrentTarget(null);
          }
        }
      } catch (err) {
        // No existing target - that's OK
        console.log('No existing target found');
        setHasTarget(false);
      }
    };
    checkExistingTarget();
  }, [patientId]);

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
      const riskFactors = {
        age, family_history: familyHistory, num_agm: numAGM,
        cdr_od: cdrOD, notching_od: notchingOD, rnfl_defect_od: rnflDefectOD, disc_hemorrhage_od: discHemorrhageOD,
        cdr_os: cdrOS, notching_os: notchingOS, rnfl_defect_os: rnflDefectOS, disc_hemorrhage_os: discHemorrhageOS,
        mean_deviation_od: meanDeviationOD, central_field_od: centralFieldOD,
        mean_deviation_os: meanDeviationOS, central_field_os: centralFieldOS,
        patient_factors: patientFactors,
        cct_od: cctOD, myopia_od: myopiaOD, ocular_modifiers_od: ocularModifiersOD,
        cct_os: cctOS, myopia_os: myopiaOS, ocular_modifiers_os: ocularModifiersOS,
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

      if (!response.ok) throw new Error(`Failed to calculate target (${response.status})`);
      const data = await response.json();
      setCalculation(data);
      
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
      const calcTargetOD = odResult.calculated_target || calculation.calculation?.target_iop_od;
      const calcTargetOS = osResult.calculated_target || calculation.calculation?.target_iop_os;

      const queryParams = new URLSearchParams({
        calculated_target_od: calcTargetOD.toString(),
        calculated_target_os: calcTargetOS.toString(),
        final_target_od: doctorTargetOD.toString(),
        final_target_os: doctorTargetOS.toString(),
        override_reason: doctorNotes || '',
        trbs_score_od: (odResult.trbs_score || 0).toString(),
        trbs_score_os: (osResult.trbs_score || 0).toString(),
        risk_tier_od: odResult.risk_tier || '',
        risk_tier_os: osResult.risk_tier || '',
        baseline_iop_od: baselineIOPOD.toString(),
        baseline_iop_os: baselineIOPOS.toString(),
        set_by: 'Ophthalmologist'
      });

      const response = await fetch(
        `http://localhost:8000/api/targets/${patientId}/save-with-override?${queryParams.toString()}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) throw new Error(`Failed to save target (${response.status})`);
      const result = await response.json();
      setHasTarget(true);
      setCurrentTarget({ target_iop_od: doctorTargetOD, target_iop_os: doctorTargetOS });
      
      // Get current IOP to show status
      try {
        const measurementResponse = await fetch(`http://localhost:8000/api/measurements/${patientId}/latest`);
        if (measurementResponse.ok) {
          const measurementData = await measurementResponse.json();
          if (measurementData.exists && measurementData.measurement) {
            const currentIOPOD = measurementData.measurement.iop_od;
            const currentIOPOS = measurementData.measurement.iop_os;
            const targetOD = parseFloat(doctorTargetOD);
            const targetOS = parseFloat(doctorTargetOS);
            
            let statusMessages = [];
            
            if (targetOD && currentIOPOD !== null && currentIOPOD !== undefined) {
              const diffOD = currentIOPOD - targetOD;
              if (diffOD > 0) {
                statusMessages.push(`OD: Above Target (${currentIOPOD.toFixed(1)} > ${targetOD.toFixed(1)} mmHg)`);
              } else if (diffOD >= -2) {
                statusMessages.push(`OD: Within Target (${currentIOPOD.toFixed(1)} ≤ ${targetOD.toFixed(1)} mmHg)`);
              } else {
                statusMessages.push(`OD: Below Target (${currentIOPOD.toFixed(1)} < ${targetOD.toFixed(1)} mmHg)`);
              }
            }
            
            if (targetOS && currentIOPOS !== null && currentIOPOS !== undefined) {
              const diffOS = currentIOPOS - targetOS;
              if (diffOS > 0) {
                statusMessages.push(`OS: Above Target (${currentIOPOS.toFixed(1)} > ${targetOS.toFixed(1)} mmHg)`);
              } else if (diffOS >= -2) {
                statusMessages.push(`OS: Within Target (${currentIOPOS.toFixed(1)} ≤ ${targetOS.toFixed(1)} mmHg)`);
              } else {
                statusMessages.push(`OS: Below Target (${currentIOPOS.toFixed(1)} < ${targetOS.toFixed(1)} mmHg)`);
              }
            }
            
            if (statusMessages.length > 0) {
              alert(`✓ Target IOP saved successfully!\n\n${statusMessages.join('\n')}`);
            } else {
              alert('✓ Target IOP saved successfully!');
            }
          } else {
            alert('✓ Target IOP saved successfully! (No current measurement to compare)');
          }
        } else {
          alert('✓ Target IOP saved successfully!');
        }
      } catch (err) {
        console.error('Error checking measurement status:', err);
        alert('✓ Target IOP saved successfully!');
      }
      
      if (onTargetCalculated) onTargetCalculated({ target_iop_od: doctorTargetOD, target_iop_os: doctorTargetOS, ...result });
    } catch (err) {
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
    <div className="target-iop-container">
      {/* Status Banner */}
      <div className={`target-status-banner ${hasTarget ? 'has-target' : 'no-target'}`}>
        <div className="banner-left">
          <AlertTriangle size={20} />
          <span className="banner-title">{hasTarget ? 'Target Set' : 'No Target Set'}</span>
        </div>
        <span className="banner-message">
          {hasTarget 
            ? `Current Target - OD: ${currentTarget?.target_iop_od} mmHg, OS: ${currentTarget?.target_iop_os} mmHg`
            : 'Please calculate and set a target IOP first to track pressure control.'}
        </span>
      </div>

      {/* Main Calculator Card */}
      <div className="target-calculator-card">
        <div className="card-header-row">
          <div className="card-title-section">
            <span className="target-icon">🎯</span>
            <div>
              <h2>Target IOP Calculator (TRBS) - Per Eye</h2>
              <p className="card-subtitle">
                Calculates individualized target IOP for <strong>EACH EYE</strong> based on Total Risk Burden Score and reduction percentages based on risk tier.
              </p>
            </div>
          </div>
          <button 
            className={`btn-auto-populate ${emrPopulated ? 'populated' : ''}`}
            onClick={fetchAndPopulateFromEMR}
            disabled={emrLoading || !patientId}
          >
            <Clipboard size={16} />
            {emrLoading ? 'Loading...' : emrPopulated ? '🔄 Refresh from EMR' : 'Auto-populate from EMR'}
          </button>
        </div>

        {/* EMR Populated Indicator */}
        {emrPopulated && (
          <div className="emr-populated-banner">
            ✓ Data auto-populated from EMR sections (History, Fundus Exam, Investigation). 
            Fields marked with 🔗 are linked to EMR.
          </div>
        )}

        {error && <div className="error-banner">❌ {error}</div>}

        {/* Domain B: Baseline IOP */}
        <div className="domain-card">
          <div className="domain-header">
            <span className="domain-letter">B.</span>
            <h3>Baseline IOP</h3>
            <span className="domain-range">(0-4 pts) - Shared for both eyes</span>
          </div>
          
          {baselineSource === 'default' && (
            <div className="warning-banner">
              <AlertTriangle size={16} />
              No baseline found - using default values. Please set correct baseline.
            </div>
          )}

          <div className="baseline-inputs">
            <div className="input-group">
              <label>IOP OD (RIGHT EYE) - UNTREATED</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  value={baselineIOPOD || ''}
                  onChange={(e) => setBaselineIOPOD(parseFloat(e.target.value) || 0)}
                  min="8" max="60" step="0.5"
                />
                <span className="unit">mmHg</span>
              </div>
            </div>
            <div className="input-group">
              <label>IOP OS (LEFT EYE) - UNTREATED</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  value={baselineIOPOS || ''}
                  onChange={(e) => setBaselineIOPOS(parseFloat(e.target.value) || 0)}
                  min="8" max="60" step="0.5"
                />
                <span className="unit">mmHg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Domain A: Demographics */}
        <div className="domain-card">
          <div className="domain-header">
            <span className="domain-letter">A.</span>
            <h3>Demographic Risk</h3>
            <span className="domain-range">(1-4 pts) - Shared for both eyes</span>
          </div>
          <div className="domain-row">
            <div className="input-group">
              <label>
                AGE RANGE
                {patientAge && (
                  <span className="auto-badge">(PATIENT AGE: {patientAge} YEARS - AUTO-DETECTED)</span>
                )}
              </label>
              <select value={age} onChange={(e) => setAge(e.target.value)}>
                <option value="under_50">&lt;50 years (3 pts)</option>
                <option value="50_to_70">50-70 years (2 pts)</option>
                <option value="over_70">&gt;70 years (1 pt)</option>
              </select>
            </div>
            <div className="input-group">
              <label>FAMILY HISTORY (1ST DEGREE)</label>
              <select value={familyHistory} onChange={(e) => setFamilyHistory(e.target.value)}>
                <option value="absent">Absent (0 pts)</option>
                <option value="present">Present (1 pt)</option>
              </select>
            </div>
          </div>
        </div>


        {/* Domain C: Structural */}
        <div className="domain-card">
          <div className="domain-header">
            <span className="domain-letter">C.</span>
            <h3>Structural Changes</h3>
            <span className="domain-range">(0-9 pts) - Per Eye</span>
          </div>
          <div className="eye-grid">
            <div className="eye-column">
              <h4 className="eye-title">👁️ Right Eye (OD)</h4>
              <div className="input-group">
                <label>VERTICAL CDR</label>
                <select value={cdrOD} onChange={(e) => setCdrOD(e.target.value)}>
                  <option value="0.5_or_less">≤0.5 (0 pts)</option>
                  <option value="0.6">0.6 (1 pt)</option>
                  <option value="0.7">0.7 (2 pts)</option>
                  <option value="0.8">0.8 (3 pts)</option>
                  <option value="0.9_or_more">≥0.9 (4 pts)</option>
                </select>
              </div>
              <div className="input-group">
                <label>FOCAL NOTCHING</label>
                <select value={notchingOD} onChange={(e) => setNotchingOD(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="unipolar">Unipolar (2 pts)</option>
                  <option value="bipolar">Bipolar (3 pts)</option>
                </select>
              </div>
              <div className="input-group">
                <label>RNFL DEFECT</label>
                <select value={rnflDefectOD} onChange={(e) => setRnflDefectOD(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="present">Present (1 pt)</option>
                </select>
              </div>
              <div className="input-group">
                <label>DISC HEMORRHAGE</label>
                <select value={discHemorrhageOD} onChange={(e) => setDiscHemorrhageOD(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="present">Present (1 pt)</option>
                </select>
              </div>
            </div>
            <div className="eye-column">
              <h4 className="eye-title">👁️ Left Eye (OS)</h4>
              <div className="input-group">
                <label>VERTICAL CDR</label>
                <select value={cdrOS} onChange={(e) => setCdrOS(e.target.value)}>
                  <option value="0.5_or_less">≤0.5 (0 pts)</option>
                  <option value="0.6">0.6 (1 pt)</option>
                  <option value="0.7">0.7 (2 pts)</option>
                  <option value="0.8">0.8 (3 pts)</option>
                  <option value="0.9_or_more">≥0.9 (4 pts)</option>
                </select>
              </div>
              <div className="input-group">
                <label>FOCAL NOTCHING</label>
                <select value={notchingOS} onChange={(e) => setNotchingOS(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="unipolar">Unipolar (2 pts)</option>
                  <option value="bipolar">Bipolar (3 pts)</option>
                </select>
              </div>
              <div className="input-group">
                <label>RNFL DEFECT</label>
                <select value={rnflDefectOS} onChange={(e) => setRnflDefectOS(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="present">Present (1 pt)</option>
                </select>
              </div>
              <div className="input-group">
                <label>DISC HEMORRHAGE</label>
                <select value={discHemorrhageOS} onChange={(e) => setDiscHemorrhageOS(e.target.value)}>
                  <option value="absent">Absent (0 pts)</option>
                  <option value="present">Present (1 pt)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Domain D: Functional */}
        <div className="domain-card">
          <div className="domain-header">
            <span className="domain-letter">D.</span>
            <h3>Functional / Visual Field</h3>
            <span className="domain-range">(0-5 pts) - Per Eye</span>
          </div>
          <div className="eye-grid">
            <div className="eye-column">
              <h4 className="eye-title">👁️ Right Eye (OD)</h4>
              <div className="input-group">
                <label>MEAN DEVIATION (MD)</label>
                <select value={meanDeviationOD} onChange={(e) => setMeanDeviationOD(e.target.value)}>
                  <option value="hfa_not_done">HFA not done in first visit (0 pts)</option>
                  <option value="greater_than_minus_6">≥-6 dB (1 pt)</option>
                  <option value="minus_6_to_minus_12">-6.01 to -12 dB (2 pts)</option>
                  <option value="minus_12_to_minus_20">-12.01 to -20 dB (3 pts)</option>
                  <option value="less_than_minus_20">&lt;-20.01 dB (4 pts)</option>
                  <option value="hfa_not_possible">HFA not possible due to advanced disease (4 pts)</option>
                </select>
              </div>
              <div className="input-group">
                <label>CENTRAL FIELD INVOLVEMENT (5 DEGREES)</label>
                <select value={centralFieldOD} onChange={(e) => setCentralFieldOD(e.target.value)}>
                  <option value="no">No (0 pts)</option>
                  <option value="yes">Yes (2 pts)</option>
                </select>
              </div>
            </div>
            <div className="eye-column">
              <h4 className="eye-title">👁️ Left Eye (OS)</h4>
              <div className="input-group">
                <label>MEAN DEVIATION (MD)</label>
                <select value={meanDeviationOS} onChange={(e) => setMeanDeviationOS(e.target.value)}>
                  <option value="hfa_not_done">HFA not done in first visit (0 pts)</option>
                  <option value="greater_than_minus_6">≥-6 dB (1 pt)</option>
                  <option value="minus_6_to_minus_12">-6.01 to -12 dB (2 pts)</option>
                  <option value="minus_12_to_minus_20">-12.01 to -20 dB (3 pts)</option>
                  <option value="less_than_minus_20">&lt;-20.01 dB (4 pts)</option>
                  <option value="hfa_not_possible">HFA not possible due to advanced disease (4 pts)</option>
                </select>
              </div>
              <div className="input-group">
                <label>CENTRAL FIELD INVOLVEMENT (5 DEGREES)</label>
                <select value={centralFieldOS} onChange={(e) => setCentralFieldOS(e.target.value)}>
                  <option value="no">No (0 pts)</option>
                  <option value="yes">Yes (2 pts)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Domain E: Disease/Patient Factors */}
        <div className="domain-card">
          <div className="domain-header">
            <span className="domain-letter">E.</span>
            <h3>Disease / Patient Factors</h3>
            <span className="domain-range">(0-3 pts) - Shared for both eyes</span>
          </div>
          <div className="checkbox-grid">
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

        {/* Domain F: Ocular Risk Modifiers */}
        <div className="domain-card">
          <div className="domain-header">
            <span className="domain-letter">F.</span>
            <h3>Ocular Risk Modifiers</h3>
            <span className="domain-range">(0-8 pts) - Per Eye</span>
          </div>
          <div className="eye-grid">
            <div className="eye-column">
              <h4 className="eye-title">👁️ Right Eye (OD)</h4>
              <div className="input-group">
                <label>CCT (CENTRAL CORNEAL THICKNESS)</label>
                <select value={cctOD} onChange={(e) => setCctOD(e.target.value)}>
                  <option value="normal">≥500 µm (0 pts)</option>
                  <option value="thin">&lt;500 µm (+1 pt)</option>
                </select>
              </div>
              <div className="input-group">
                <label>MYOPIA (WITHOUT CATARACT)</label>
                <select value={myopiaOD} onChange={(e) => setMyopiaOD(e.target.value)}>
                  <option value="none">None / With Cataract (0 pts)</option>
                  <option value="low_myopia">Low Myopia (-1DS to -3DS) (+1 pt)</option>
                  <option value="mod_high_myopia">Mod to High Myopia (&lt;-3DS) (+2 pts)</option>
                </select>
              </div>
              <div className="checkbox-list">
                {[
                  { key: 'angle_recession', label: 'Angle Recession >180° (+1)' },
                  { key: 'pseudoexfoliation', label: 'Pseudoexfoliation (+1)' },
                  { key: 'pigment_dispersion', label: 'Pigment Dispersion (+1)' },
                  { key: 'steroid_responder', label: 'Steroid Responder (+1)' }
                ].map(item => (
                  <label key={item.key} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={ocularModifiersOD.includes(item.key)}
                      onChange={() => toggleArrayItem(ocularModifiersOD, setOcularModifiersOD, item.key)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="eye-column">
              <h4 className="eye-title">👁️ Left Eye (OS)</h4>
              <div className="input-group">
                <label>CCT (CENTRAL CORNEAL THICKNESS)</label>
                <select value={cctOS} onChange={(e) => setCctOS(e.target.value)}>
                  <option value="normal">≥500 µm (0 pts)</option>
                  <option value="thin">&lt;500 µm (+1 pt)</option>
                </select>
              </div>
              <div className="input-group">
                <label>MYOPIA (WITHOUT CATARACT)</label>
                <select value={myopiaOS} onChange={(e) => setMyopiaOS(e.target.value)}>
                  <option value="none">None / With Cataract (0 pts)</option>
                  <option value="low_myopia">Low Myopia (-1DS to -3DS) (+1 pt)</option>
                  <option value="mod_high_myopia">Mod to High Myopia (&lt;-3DS) (+2 pts)</option>
                </select>
              </div>
              <div className="checkbox-list">
                {[
                  { key: 'angle_recession', label: 'Angle Recession >180° (+1)' },
                  { key: 'pseudoexfoliation', label: 'Pseudoexfoliation (+1)' },
                  { key: 'pigment_dispersion', label: 'Pigment Dispersion (+1)' },
                  { key: 'steroid_responder', label: 'Steroid Responder (+1)' }
                ].map(item => (
                  <label key={item.key} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={ocularModifiersOS.includes(item.key)}
                      onChange={() => toggleArrayItem(ocularModifiersOS, setOcularModifiersOS, item.key)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Domain G: Systemic Risk Modifiers */}
        <div className="domain-card">
          <div className="domain-header">
            <span className="domain-letter">F.</span>
            <h3>Systemic Risk Modifiers</h3>
            <span className="domain-range">(0-5 pts) - Shared for both eyes</span>
          </div>
          {emrRiskFactors?.dopp_info && (
            <div className={`dopp-warning-banner ${!(emrRiskFactors.dopp_info.low_perfusion_od || emrRiskFactors.dopp_info.low_perfusion_os) ? 'info' : ''}`}>
              <span className="warning-icon">
                {emrRiskFactors.dopp_info.low_perfusion_od || emrRiskFactors.dopp_info.low_perfusion_os ? '⚠️' : 'ℹ️'}
              </span>
              <div className="dopp-warning-content">
                <strong>
                  {emrRiskFactors.dopp_info.low_perfusion_od || emrRiskFactors.dopp_info.low_perfusion_os
                    ? 'Low Ocular Perfusion Pressure Detected'
                    : 'BP/DOPP Calculation from EMR'}
                </strong>
                <div className="dopp-details">
                  BP: {emrRiskFactors.dopp_info.bp_value} (Diastolic: {emrRiskFactors.dopp_info.diastolic} mmHg)
                  {emrRiskFactors.dopp_info.dopp_od !== null && (
                    <span> | DOPP OD: {emrRiskFactors.dopp_info.dopp_od} mmHg {emrRiskFactors.dopp_info.low_perfusion_od ? <strong style={{color: '#dc2626'}}>(Low!)</strong> : ''}</span>
                  )}
                  {emrRiskFactors.dopp_info.dopp_os !== null && (
                    <span> | DOPP OS: {emrRiskFactors.dopp_info.dopp_os} mmHg {emrRiskFactors.dopp_info.low_perfusion_os ? <strong style={{color: '#dc2626'}}>(Low!)</strong> : ''}</span>
                  )}
                </div>
                <small>
                  DOPP = Diastolic BP - IOP. If &lt;50 mmHg, "Low Ocular Perfusion Pressure" is automatically selected below.
                </small>
              </div>
            </div>
          )}
          <div className="checkbox-grid">
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
                <span>
                  {item.label}
                  {item.key === 'low_ocular_perfusion' && emrRiskFactors?.dopp_info && (emrRiskFactors.dopp_info.low_perfusion_od || emrRiskFactors.dopp_info.low_perfusion_os) && (
                    <span className="auto-detected-badge" style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>(Auto-detected from BP)</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>


        {/* Options */}

        {/* Calculate Button */}
        <button onClick={calculateTarget} disabled={loading} className="btn-calculate">
          {loading ? '⏳ Calculating...' : '🎯 Calculate Target IOP'}
        </button>

        {/* Results */}
        {calculation && (
          <div className="results-section">
            <h3>📊 Calculation Results</h3>
            <div className="results-grid">
              <div className="result-card od">
                <h4>👁️ Right Eye (OD)</h4>
                <div className="result-row">
                  <span>TRBS Score:</span>
                  <strong>{calculation.calculation?.od_result?.trbs_score || 'N/A'}/25</strong>
                </div>
                <div className="result-row">
                  <span>Risk Tier:</span>
                  <strong style={{ color: getRiskTierColor(calculation.calculation?.od_result?.risk_tier) }}>
                    {calculation.calculation?.od_result?.risk_tier || 'N/A'}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Reduction:</span>
                  <strong>{calculation.calculation?.od_result?.reduction_applied || 'N/A'}%</strong>
                </div>
                <div className="result-row target">
                  <span>🎯 Target:</span>
                  <strong className="target-value">
                    {calculation.calculation?.od_result?.calculated_target || calculation.calculation?.target_iop_od} mmHg
                  </strong>
                </div>
              </div>
              <div className="result-card os">
                <h4>👁️ Left Eye (OS)</h4>
                <div className="result-row">
                  <span>TRBS Score:</span>
                  <strong>{calculation.calculation?.os_result?.trbs_score || 'N/A'}/25</strong>
                </div>
                <div className="result-row">
                  <span>Risk Tier:</span>
                  <strong style={{ color: getRiskTierColor(calculation.calculation?.os_result?.risk_tier) }}>
                    {calculation.calculation?.os_result?.risk_tier || 'N/A'}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Reduction:</span>
                  <strong>{calculation.calculation?.os_result?.reduction_applied || 'N/A'}%</strong>
                </div>
                <div className="result-row target">
                  <span>🎯 Target:</span>
                  <strong className="target-value">
                    {calculation.calculation?.os_result?.calculated_target || calculation.calculation?.target_iop_os} mmHg
                  </strong>
                </div>
              </div>
            </div>

            {/* Doctor Override */}
            <div className="override-section">
              <h4>👨‍⚕️ Doctor Confirmation / Override</h4>
              <div className="override-grid">
                <div className="override-input">
                  <label>Final Target OD (mmHg)</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={doctorTargetOD || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setDoctorTargetOD(val);
                        const calcVal = calculation.calculation?.od_result?.calculated_target || calculation.calculation?.target_iop_od;
                        setIsOverriddenOD(Math.abs(val - calcVal) > 0.1);
                      }}
                      min="6" max="25" step="0.5"
                      className={isOverriddenOD ? 'overridden' : ''}
                    />
                    <span className="unit">mmHg</span>
                  </div>
                  {isOverriddenOD && <span className="override-badge">⚠️ Modified</span>}
                </div>
                <div className="override-input">
                  <label>Final Target OS (mmHg)</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={doctorTargetOS || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setDoctorTargetOS(val);
                        const calcVal = calculation.calculation?.os_result?.calculated_target || calculation.calculation?.target_iop_os;
                        setIsOverriddenOS(Math.abs(val - calcVal) > 0.1);
                      }}
                      min="6" max="25" step="0.5"
                      className={isOverriddenOS ? 'overridden' : ''}
                    />
                    <span className="unit">mmHg</span>
                  </div>
                  {isOverriddenOS && <span className="override-badge">⚠️ Modified</span>}
                </div>
              </div>

              {(isOverriddenOD || isOverriddenOS) && (
                <div className="override-notes">
                  <label>📝 Reason for Override <span className="required">(Required)</span></label>
                  <textarea
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Clinical reasoning for modifying the calculated target..."
                    rows="3"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                onClick={() => {
                  const odCalc = calculation.calculation?.od_result?.calculated_target || calculation.calculation?.target_iop_od;
                  const osCalc = calculation.calculation?.os_result?.calculated_target || calculation.calculation?.target_iop_os;
                  setDoctorTargetOD(odCalc);
                  setDoctorTargetOS(osCalc);
                  setIsOverriddenOD(false);
                  setIsOverriddenOS(false);
                  setDoctorNotes('');
                }}
                className="btn-reset"
              >
                ↺ Reset to Calculated
              </button>
              <button
                onClick={saveTarget}
                className="btn-save"
                disabled={(isOverriddenOD || isOverriddenOS) && !doctorNotes.trim()}
              >
                {(isOverriddenOD || isOverriddenOS) ? '✓ Save with Override' : '✓ Approve & Save Target'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
