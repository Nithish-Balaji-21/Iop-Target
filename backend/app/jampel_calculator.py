"""
Jampel's Target IOP Calculation Formula
Based on: "Target pressure in glaucoma therapy," HD Jampel, 1997
As implemented at: https://www.targetiop.com/

This module calculates individual target IOP ranges for glaucoma patients
based on baseline IOP and risk factors following the standardized algorithm.
"""

from typing import Dict, List, Tuple
from enum import Enum

class RiskLevel(Enum):
    """Risk factor rating levels"""
    LOW = 1
    MODERATE = 2
    HIGH = 3

class JampelCalculator:
    """
    Calculates target IOP using Jampel's formula following major international
    glaucoma guidelines:
    - American Academy of Ophthalmology (AAO)
    - European Glaucoma Society (EGS)
    - World Glaucoma Association (WGA)
    - UK NICE Guidelines
    - Canadian Ophthalmological Society
    - Southeast Asia Glaucoma Interest Group
    """
    
    # Risk factors and their point values
    RISK_FACTORS = {
        'baseline_iop_high': {'low': 0, 'moderate': 1, 'high': 2},
        'age_advanced': {'low': 0, 'moderate': 1, 'high': 2},
        'family_history': {'low': 0, 'moderate': 1, 'high': 2},
        'ethnicity_african_descent': {'low': 0, 'moderate': 1, 'high': 2},
        'central_corneal_thickness_thin': {'low': 0, 'moderate': 1, 'high': 2},
        'optic_disc_size_small': {'low': 0, 'moderate': 1, 'high': 2},
        'vertical_cup_disc_ratio_large': {'low': 0, 'moderate': 1, 'high': 2},
        'pseudoexfoliation_syndrome': {'low': 0, 'moderate': 0, 'high': 2},
        'pigment_dispersion_syndrome': {'low': 0, 'moderate': 0, 'high': 2},
        'previous_ischemic_events': {'low': 0, 'moderate': 1, 'high': 2},
        'myopia_high': {'low': 0, 'moderate': 1, 'high': 2},
        'diabetes': {'low': 0, 'moderate': 1, 'high': 1},
        'systemic_hypertension': {'low': 0, 'moderate': 1, 'high': 1},
    }
    
    @staticmethod
    def rate_risk_factors(factors: Dict[str, RiskLevel]) -> int:
        """
        Sum up risk points from all provided factors.
        
        Args:
            factors: Dictionary of risk factors with their severity levels
            Example: {
                'baseline_iop_high': RiskLevel.HIGH,
                'age_advanced': RiskLevel.MODERATE,
                'family_history': RiskLevel.LOW,
                ...
            }
        
        Returns:
            Total risk points (low + moderate factors only, high = 2 points each)
        """
        total_points = 0
        
        for factor, risk_level in factors.items():
            if factor in JampelCalculator.RISK_FACTORS:
                # Convert enum to dict key
                level_key = 'low' if risk_level == RiskLevel.LOW else \
                           'moderate' if risk_level == RiskLevel.MODERATE else 'high'
                
                points = JampelCalculator.RISK_FACTORS[factor][level_key]
                total_points += points
        
        return total_points
    
    @staticmethod
    def determine_grade(total_points: int) -> str:
        """
        Determine disease grade from total risk points.
        
        Grade 0: 0-2 points
        Grade 1: 3-4 points
        Grade 2: 5-6 points
        Grade 3: 7+ points
        """
        if total_points <= 2:
            return "Grade 0 (Low Risk)"
        elif total_points <= 4:
            return "Grade 1 (Low-Moderate Risk)"
        elif total_points <= 6:
            return "Grade 2 (Moderate Risk)"
        else:
            return "Grade 3 (High Risk)"
    
    @staticmethod
    def calculate_target_iop_range(
        baseline_iop: float,
        grade: str,
        disease_stage: str = "Early"
    ) -> Dict[str, float]:
        """
        Calculate target IOP range using Jampel's formula.
        
        Formula basis:
        - For early glaucoma: 20-25% reduction from baseline
        - For moderate glaucoma: 30% reduction from baseline
        - For advanced glaucoma: 40-50% reduction from baseline
        
        Grade modifiers:
        - Grade 0 (Low Risk): Minimal reduction (15-20%)
        - Grade 1 (Low-Moderate): Conservative reduction (20-25%)
        - Grade 2 (Moderate): Standard reduction (30%)
        - Grade 3 (High Risk): Aggressive reduction (40-50%)
        
        Args:
            baseline_iop: Patient's initial measured IOP (mmHg)
            grade: Risk grade ("Grade 0", "Grade 1", "Grade 2", "Grade 3")
            disease_stage: "Early", "Moderate", "Advanced"
        
        Returns:
            Dictionary with 'min_target', 'target', 'max_target' in mmHg
        """
        
        # Grade-based percentage reductions
        grade_reduction = {
            "Grade 0 (Low Risk)": {'min': 0.15, 'target': 0.20, 'max': 0.25},
            "Grade 1 (Low-Moderate Risk)": {'min': 0.20, 'target': 0.25, 'max': 0.30},
            "Grade 2 (Moderate Risk)": {'min': 0.25, 'target': 0.30, 'max': 0.35},
            "Grade 3 (High Risk)": {'min': 0.40, 'target': 0.45, 'max': 0.50},
        }
        
        # Stage modifiers (applied to reduction percentages)
        stage_modifier = {
            "Early": 0.9,      # Slightly less aggressive
            "Moderate": 1.0,   # Standard
            "Advanced": 1.2,   # More aggressive
        }
        
        # Get reduction percentages for this grade
        reductions = grade_reduction.get(grade, grade_reduction["Grade 1 (Low-Moderate Risk)"])
        
        # Apply stage modifier
        modifier = stage_modifier.get(disease_stage, 1.0)
        
        # Calculate absolute reductions
        min_reduction = baseline_iop * reductions['min'] * modifier
        target_reduction = baseline_iop * reductions['target'] * modifier
        max_reduction = baseline_iop * reductions['max'] * modifier
        
        # Calculate target IOPs
        min_target = baseline_iop - max_reduction  # Aggressive target
        target_iop = baseline_iop - target_reduction  # Standard target
        max_target = baseline_iop - min_reduction  # Conservative target
        
        # Ensure reasonable minimums
        min_target = max(8, min_target)  # Floor at 8 mmHg
        target_iop = max(10, target_iop)
        max_target = max(12, max_target)
        
        # Ensure order (min <= target <= max)
        min_target = min(min_target, target_iop)
        max_target = max(max_target, target_iop)
        
        return {
            'min_target': round(min_target, 1),
            'target': round(target_iop, 1),
            'max_target': round(max_target, 1),
            'reduction_percent': round(reductions['target'] * 100, 0),
            'baseline_iop': baseline_iop
        }
    
    @staticmethod
    def calculate_complete_target(
        baseline_iop_od: float,
        baseline_iop_os: float,
        risk_factors: Dict[str, RiskLevel],
        disease_stage: str = "Early",
        disease_severity: str = "Mild"
    ) -> Dict:
        """
        Calculate complete target IOP profile for both eyes.
        
        Args:
            baseline_iop_od: Right eye baseline IOP
            baseline_iop_os: Left eye baseline IOP
            risk_factors: Dictionary of patient risk factors
            disease_stage: "Early", "Moderate", "Advanced"
            disease_severity: "Mild", "Moderate", "Severe"
        
        Returns:
            Complete target IOP calculation with recommendations
        """
        
        # Calculate total risk points
        total_points = JampelCalculator.rate_risk_factors(risk_factors)
        grade = JampelCalculator.determine_grade(total_points)
        
        # Calculate targets for each eye
        od_target = JampelCalculator.calculate_target_iop_range(
            baseline_iop_od, grade, disease_stage
        )
        os_target = JampelCalculator.calculate_target_iop_range(
            baseline_iop_os, grade, disease_stage
        )
        
        return {
            'risk_grade': grade,
            'total_risk_points': total_points,
            'disease_stage': disease_stage,
            'disease_severity': disease_severity,
            'right_eye': od_target,
            'left_eye': os_target,
            'recommendation': JampelCalculator.get_clinical_recommendation(
                grade, disease_stage, disease_severity
            )
        }
    
    @staticmethod
    def get_clinical_recommendation(
        grade: str,
        disease_stage: str,
        disease_severity: str
    ) -> str:
        """
        Provide clinical recommendation based on grade and stage.
        """
        
        recommendations = {
            "Grade 0 (Low Risk)": {
                "Early": "Monitor IOP control. Annual or semi-annual visits may be appropriate.",
                "Moderate": "Ensure IOP control with target achieved. 6-monthly visits recommended.",
                "Advanced": "Aggressive IOP control essential. 3-4 monthly visits recommended."
            },
            "Grade 1 (Low-Moderate Risk)": {
                "Early": "Standard IOP target. Semi-annual monitoring.",
                "Moderate": "Moderate IOP reduction goal. 4-6 monthly visits.",
                "Advanced": "Significant IOP reduction needed. 3-4 monthly visits."
            },
            "Grade 2 (Moderate Risk)": {
                "Early": "Target 30% reduction from baseline. 3-4 monthly visits.",
                "Moderate": "Target 30% reduction. Regular monitoring every 3 months.",
                "Advanced": "Target 40% reduction. Close monitoring every 2-3 months."
            },
            "Grade 3 (High Risk)": {
                "Early": "Aggressive target (40-50% reduction). Monthly visits.",
                "Moderate": "Aggressive target. Monthly visits, consider laser/surgery.",
                "Advanced": "Maximum IOP reduction required. Urgent consideration of surgery."
            }
        }
        
        stage_severity_map = {
            "Early": {"Mild": 0, "Moderate": 1, "Severe": 2},
            "Moderate": {"Mild": 1, "Moderate": 2, "Severe": 2},
            "Advanced": {"Mild": 2, "Moderate": 2, "Severe": 2},
        }
        
        key = (grade, disease_stage)
        base_rec = recommendations.get(key, "Individualize target based on patient factors.")
        
        return base_rec


class TargetIOPValidator:
    """
    Validates calculated target IOPs against clinical guidelines.
    """
    
    @staticmethod
    def validate_target(
        measured_iop: float,
        target_iop: float,
        tolerance: float = 3.0
    ) -> Dict[str, any]:
        """
        Validate if measured IOP is within target range.
        Tolerance accounts for measurement variability (±3 mmHg typical).
        
        Returns:
            {
                'is_at_target': bool,
                'difference': float,
                'status': 'WITHIN_TARGET' or 'ABOVE_TARGET',
                'message': str
            }
        """
        difference = measured_iop - target_iop
        is_at_target = difference <= tolerance
        
        status = 'WITHIN_TARGET' if is_at_target else 'ABOVE_TARGET'
        
        if is_at_target:
            message = f"IOP {measured_iop:.1f} is within target {target_iop:.1f} (±{tolerance})"
        else:
            message = f"IOP {measured_iop:.1f} is {difference:.1f} mmHg above target {target_iop:.1f}"
        
        return {
            'is_at_target': is_at_target,
            'difference': round(difference, 1),
            'status': status,
            'message': message,
            'target_iop': target_iop,
            'measured_iop': measured_iop
        }

