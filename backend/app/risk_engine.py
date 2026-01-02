"""
Business logic for glaucoma risk stratification and clinical decision support
"""
from typing import List, Tuple, Dict
from datetime import datetime, timedelta

class RiskEngine:
    """
    Automated risk stratification engine for glaucoma patients.
    Evaluates: IOP control, disease progression, structural changes, functional changes.
    """
    
    # IOP Status Constants
    WITHIN_TARGET = "WITHIN_TARGET"
    ABOVE_TARGET = "ABOVE_TARGET"
    BELOW_TARGET = "BELOW_TARGET"
    
    # Risk Levels
    LOW_RISK = "LOW"
    MODERATE_RISK = "MODERATE"
    HIGH_RISK = "HIGH"
    
    @staticmethod
    def evaluate_iop_status(
        measured_iop: float,
        target_iop: float,
        tolerance: float = None
    ) -> Tuple[str, int]:
        """
        Evaluate if measured IOP is within acceptable target range.
        Accounts for measurements both above AND below target.
        
        Tolerance is now PROPORTIONAL to target (15% of target, min 2 mmHg):
        - Target 18 mmHg → tolerance ~2.7 mmHg
        - Target 14 mmHg → tolerance ~2.1 mmHg
        - Target 12 mmHg → tolerance ~2.0 mmHg (min)
        
        Status:
        - WITHIN_TARGET: |measured - target| <= tolerance
        - ABOVE_TARGET: measured > target + tolerance (severity based on overage)
        - BELOW_TARGET: measured < target - tolerance (severity based on underage, less severe)
        
        Returns:
            (status, severity_score) where severity_score is 0-30
        """
        # Calculate proportional tolerance (15% of target, minimum 2 mmHg)
        if tolerance is None:
            tolerance = max(2.0, target_iop * 0.15)
        
        difference = measured_iop - target_iop
        abs_difference = abs(difference)
        
        # Check if within acceptable tolerance band
        if abs_difference <= tolerance:
            # Measurement is within target range ✓
            return RiskEngine.WITHIN_TARGET, 0
        
        # Above target (pressure too high) - more concerning
        elif difference > tolerance:
            # Amount above target × weight factor
            # Severity increases more steeply for lower targets
            overage = difference - tolerance
            weight = 3.0 + (18 - target_iop) * 0.2  # Higher weight for lower targets
            severity = min(30, int(overage * weight))
            return RiskEngine.ABOVE_TARGET, severity
        
        # Below target (pressure too low/hypotony) - also concerning but less severe
        else:  # difference < -tolerance
            # Amount below target × weight factor (less aggressive than above)
            underage = abs_difference - tolerance
            severity = min(20, int(underage * 2))
            return RiskEngine.BELOW_TARGET, severity
    
    @staticmethod
    def assess_rnfl_progression(
        current_rnfl: float,
        previous_measurements: List[float],
        months_between_visits: int = 3
    ) -> Tuple[str, int]:
        """
        Assess OCT RNFL thinning progression.
        Red flag: >2 microns/year loss
        
        Returns:
            (status, severity_score) where severity_score is 0-25
        """
        if not previous_measurements or len(previous_measurements) < 2:
            return "BASELINE", 0
        
        # Calculate average rate of change (microns/month)
        change_per_month = (current_rnfl - previous_measurements[-1]) / max(months_between_visits, 1)
        annual_loss = abs(change_per_month * 12)
        
        if annual_loss > 2.0:  # Significant progression
            return "PROGRESSIVE", min(25, int(annual_loss * 5))
        elif annual_loss > 1.0:  # Moderate progression
            return "MARGINAL", 10
        else:
            return "STABLE", 0
    
    @staticmethod
    def assess_vf_progression(
        current_md: float,
        previous_measurements: List[float],
        months_between_visits: int = 3
    ) -> Tuple[str, int]:
        """
        Assess Visual Field (VF) Mean Deviation progression.
        
        MD values are typically NEGATIVE (e.g., -3 dB, -12 dB)
        MORE NEGATIVE = WORSE visual field loss
        
        Example:
        - Previous MD: -6 dB, Current MD: -9 dB → WORSENING (loss of 3 dB)
        - Previous MD: -9 dB, Current MD: -6 dB → IMPROVING (gain of 3 dB)
        
        Red flag: >1 dB/year worsening (MD becoming more negative)
        
        Returns:
            (status, severity_score) where severity_score is 0-25
        """
        if not previous_measurements or len(previous_measurements) < 2:
            return "BASELINE", 0
        
        # Calculate change: negative change = worsening (MD becoming more negative)
        # current_md - previous = negative means current is more negative (worse)
        change_per_month = (current_md - previous_measurements[-1]) / max(months_between_visits, 1)
        annual_change = change_per_month * 12
        
        # NEGATIVE annual_change means MD is getting MORE NEGATIVE = WORSENING
        # So we check if annual_change < -1.0 for significant worsening
        if annual_change < -1.0:  # Significant worsening (MD dropping >1 dB/year)
            return "PROGRESSIVE", min(25, int(abs(annual_change) * 10))
        elif annual_change < -0.5:  # Moderate worsening
            return "MARGINAL", 10
        else:
            return "STABLE", 0
    
    @staticmethod
    def calculate_risk_score(
        iop_status: str,
        iop_severity: int,
        rnfl_status: str,
        rnfl_severity: int,
        vf_status: str,
        vf_severity: int,
        disease_severity: str,
        pressure_fluctuation: float = 0.0,
        medication_adherence: str = "GOOD"
    ) -> Tuple[str, int, List[str]]:
        """
        Calculate overall risk score (0-100) and determine risk level.
        
        Risk Factors:
        - IOP control (40%)
        - RNFL progression (25%)
        - VF progression (20%)
        - Disease severity (10%)
        - Pressure fluctuation (5%)
        
        Returns:
            (risk_level, risk_score, risk_reasons)
        """
        
        score = 0
        reasons = []
        
        # IOP Control (40 points max)
        score += iop_severity * 1.3  # 0-39 points
        if iop_status == RiskEngine.ABOVE_TARGET:
            if iop_severity >= 20:
                reasons.append("IOP significantly above target")
            else:
                reasons.append("IOP above target range")
        
        # RNFL Progression (25 points max)
        score += rnfl_severity
        if rnfl_status == "PROGRESSIVE":
            reasons.append("Significant RNFL thinning detected")
        elif rnfl_status == "MARGINAL":
            reasons.append("Marginal RNFL changes observed")
        
        # VF Progression (20 points max)
        score += vf_severity
        if vf_status == "PROGRESSIVE":
            reasons.append("Visual field deterioration")
        elif vf_status == "MARGINAL":
            reasons.append("Borderline VF changes")
        
        # Disease Severity (10 points max)
        severity_map = {"MILD": 0, "MODERATE": 3, "SEVERE": 10}
        score += severity_map.get(disease_severity, 5)
        if disease_severity == "SEVERE":
            reasons.append("Severe glaucoma at baseline")
        
        # Pressure Fluctuation (5 points max)
        if pressure_fluctuation > 5:
            score += min(5, int(pressure_fluctuation))
            reasons.append(f"High IOP fluctuation ({pressure_fluctuation:.1f} mmHg)")
        
        # Medication Adherence
        if medication_adherence == "POOR":
            score = min(100, score + 15)
            reasons.append("Poor medication adherence reported")
        
        # Cap score at 100
        score = min(100, int(score))
        
        # Determine risk level
        if score < 30:
            risk_level = RiskEngine.LOW_RISK
        elif score < 70:
            risk_level = RiskEngine.MODERATE_RISK
        else:
            risk_level = RiskEngine.HIGH_RISK
        
        if not reasons:
            reasons.append("Stable glaucoma control")
        
        return risk_level, score, reasons
    
    @staticmethod
    def recommend_followup(risk_level: str, disease_severity: str) -> Tuple[int, List[str]]:
        """
        Automated follow-up recommendation engine.
        Returns days until next visit and recommended actions.
        
        Returns:
            (recommended_days, recommended_actions)
        """
        
        followup_map = {
            (RiskEngine.LOW_RISK, "MILD"): (180, ["Routine follow-up", "Annual VF and OCT"]),
            (RiskEngine.LOW_RISK, "MODERATE"): (120, ["Routine follow-up", "Annual VF and OCT"]),
            (RiskEngine.LOW_RISK, "SEVERE"): (90, ["3-monthly follow-up", "Semi-annual VF and OCT"]),
            
            (RiskEngine.MODERATE_RISK, "MILD"): (120, ["4-monthly follow-up", "Annual VF and OCT", "Review medications"]),
            (RiskEngine.MODERATE_RISK, "MODERATE"): (90, ["3-monthly follow-up", "Semi-annual VF and OCT", "Consider medication change"]),
            (RiskEngine.MODERATE_RISK, "SEVERE"): (60, ["2-monthly follow-up", "Quarterly VF and OCT", "Urgently review therapy"]),
            
            (RiskEngine.HIGH_RISK, "MILD"): (60, ["2-monthly follow-up", "Semi-annual VF and OCT", "Urgent medication review"]),
            (RiskEngine.HIGH_RISK, "MODERATE"): (30, ["Monthly follow-up", "Quarterly VF and OCT", "Consider laser/surgery"]),
            (RiskEngine.HIGH_RISK, "SEVERE"): (14, ["Urgent follow-up", "Monthly visits", "Urgent surgical consultation"]),
        }
        
        key = (risk_level, disease_severity)
        return followup_map.get(key, (90, ["Schedule routine follow-up"]))


def format_risk_assessment(
    patient_id: int,
    risk_level: str,
    risk_score: int,
    reasons: List[str],
    followup_days: int,
    followup_actions: List[str]
) -> Dict:
    """Format risk assessment for API response"""
    
    return {
        "patient_id": patient_id,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "reasons": reasons,
        "recommended_followup_days": followup_days,
        "recommended_actions": followup_actions,
        "next_visit_date": (datetime.now() + timedelta(days=followup_days)).isoformat()
    }
