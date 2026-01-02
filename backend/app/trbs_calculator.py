"""
Target IOP Calculation based on Total Risk Burden Score (TRBS)

This module calculates individual target IOP based on comprehensive risk assessment
across 7 domains - CALCULATED SEPARATELY FOR EACH EYE:
- A. Demographic Risk (0-4)
- B. Baseline IOP (0-4)
- C. Structural Changes (0-8) - per eye
- D. Functional/Visual Field Changes (0-5) - per eye
- E. Ocular Risk Modifiers (0-5) - per eye
- F. Systemic Risk Modifiers (0-5)
- G. Disease/Patient Factors (0-2)

Total TRBS Range: 0-29
"""

from typing import Dict, Tuple
from dataclasses import dataclass
from enum import Enum


class RiskTier(Enum):
    """Risk tiers based on TRBS"""
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    VERY_HIGH = "Very High"


@dataclass
class SingleEyeResult:
    """Result of target IOP calculation for a single eye"""
    eye: str  # "OD" or "OS"
    trbs_score: int
    risk_tier: str
    reduction_percentage_min: int
    reduction_percentage_max: int
    reduction_applied: int
    baseline_iop: float
    calculated_target: float
    final_target: float  # Same as calculated unless overridden
    domain_scores: Dict[str, int]


@dataclass
class TargetIOPResult:
    """Result of target IOP calculation for both eyes"""
    # Right Eye (OD)
    od_result: SingleEyeResult
    # Left Eye (OS)
    os_result: SingleEyeResult
    # Legacy fields for backward compatibility
    trbs_score: int  # Average or max of both eyes
    risk_tier: str
    reduction_percentage_min: int
    reduction_percentage_max: int
    target_iop_od: float
    target_iop_os: float
    baseline_iop_od: float
    baseline_iop_os: float
    domain_scores: Dict[str, int]


class TRBSCalculator:
    """
    Calculates Target IOP using Total Risk Burden Score (TRBS)
    NOW CALCULATES SEPARATELY FOR EACH EYE
    
    Risk Tiers (based on TRBS score):
    - 0-6 (Low): 20-25% reduction
    - 7-12 (Moderate): 30-35% reduction
    - 13-18 (High): 40-45% reduction
    - 19-25 (Very High): ≥50% reduction
    """
    
    # Domain A: Demographic Risk (0-4)
    AGE_SCORES = {
        "over_70": 1,
        "50_to_70": 2,
        "under_50": 3
    }
    
    FAMILY_HISTORY_SCORES = {
        "absent": 0,
        "present": 1
    }
    
    # Domain B: Baseline IOP (0-4)
    BASELINE_IOP_SCORES = {
        "less_than_21": 0,
        "21_to_25": 1,
        "26_to_29": 2,
        "30_to_34": 3,
        "35_or_more": 4
    }
    
    # AGM adjustment for baseline IOP
    AGM_ADJUSTMENT = {
        "0": 0,
        "1": 5,
        "2": 8,
        "3_or_more": 10
    }
    
    # Domain C: Structural Changes (0-8)
    CDR_SCORES = {
        "0.5_or_less": 0,
        "0.6": 1,
        "0.7": 2,
        "0.8": 3,
        "0.9_or_more": 4
    }
    
    NOTCHING_SCORES = {
        "absent": 0,
        "unipolar": 2,
        "bipolar": 3
    }
    
    DISC_HEMORRHAGE_SCORES = {
        "absent": 0,
        "present": 1
    }
    
    # Domain D: Functional/Visual Field Changes (0-5)
    MEAN_DEVIATION_SCORES = {
        "0_to_minus_6": 0,
        "greater_than_minus_6": 1,
        "minus_6_to_minus_12": 2,
        "less_than_minus_12": 3,
        "hfa_not_possible": 3,
        "hfa_unreliable": 2
    }
    
    CENTRAL_FIELD_SCORES = {
        "no": 0,
        "yes": 2
    }
    
    # Domain E: Ocular Risk Modifiers (0-5)
    CCT_SCORES = {
        "normal": 0,      # ≥520 µm
        "thin": 1         # <520 µm
    }
    
    # Boolean modifiers (each adds 1 if present)
    OCULAR_MODIFIERS = ["angle_recession", "pseudoexfoliation", "pigment_dispersion", "steroid_responder"]
    
    # Domain F: Systemic Risk Modifiers (0-5)
    SYSTEMIC_FACTORS = [
        "low_ocular_perfusion",
        "migraine_vasospasm",
        "raynauds",
        "sleep_apnea",
        "diabetes_mellitus"
    ]
    
    # Domain G: Disease/Patient Factors (0-2)
    PATIENT_FACTORS = [
        "one_eyed_or_advanced_fellow",
        "poor_compliance"
    ]
    
    # Risk tier definitions (reduction percentages based on TRBS score)
    RISK_TIERS = {
        RiskTier.LOW: {
            "min_score": 0,
            "max_score": 6,
            "reduction_min": 20,
            "reduction_max": 25
        },
        RiskTier.MODERATE: {
            "min_score": 7,
            "max_score": 12,
            "reduction_min": 30,
            "reduction_max": 35
        },
        RiskTier.HIGH: {
            "min_score": 13,
            "max_score": 18,
            "reduction_min": 40,
            "reduction_max": 45
        },
        RiskTier.VERY_HIGH: {
            "min_score": 19,
            "max_score": 29,
            "reduction_min": 50,
            "reduction_max": 50
        }
    }
    
    @staticmethod
    def get_risk_tier(trbs_score: int) -> Tuple[RiskTier, Dict]:
        """Determine risk tier from TRBS score"""
        for tier, config in TRBSCalculator.RISK_TIERS.items():
            if config["min_score"] <= trbs_score <= config["max_score"]:
                return tier, config
        # Default to very high if score exceeds 25
        return RiskTier.VERY_HIGH, TRBSCalculator.RISK_TIERS[RiskTier.VERY_HIGH]
    
    @staticmethod
    def calculate_target_iop(
        baseline_iop: float,
        reduction_percentage: int
    ) -> float:
        """
        Calculate target IOP from baseline.
        
        Target = Baseline × (1 - reduction%)
        """
        target = baseline_iop * (1 - reduction_percentage / 100)
        return round(target, 1)
    
    @staticmethod
    def calculate_domain_a(age: str, family_history: str) -> int:
        """Calculate Domain A: Demographic Risk (0-4)"""
        score = 0
        score += TRBSCalculator.AGE_SCORES.get(age, 0)
        score += TRBSCalculator.FAMILY_HISTORY_SCORES.get(family_history, 0)
        return min(score, 4)  # Cap at max domain score
    
    @staticmethod
    def calculate_domain_b(baseline_iop: float, num_agm: str = "0") -> int:
        """Calculate Domain B: Baseline IOP (0-4)
        
        If patient is on AGM treatment, add adjustment to current IOP
        to estimate untreated baseline.
        """
        # Add AGM adjustment to get untreated baseline estimate
        agm_adj = TRBSCalculator.AGM_ADJUSTMENT.get(num_agm, 0)
        untreated_iop = baseline_iop + agm_adj
        
        # Determine score based on untreated IOP
        if untreated_iop < 21:
            return 0
        elif untreated_iop <= 25:
            return 1
        elif untreated_iop <= 29:
            return 2
        elif untreated_iop <= 34:
            return 3
        else:
            return 4
    
    @staticmethod
    def calculate_domain_c(cdr: str, notching: str, disc_hemorrhage: str) -> int:
        """Calculate Domain C: Structural Changes (0-8)"""
        score = 0
        score += TRBSCalculator.CDR_SCORES.get(cdr, 0)
        score += TRBSCalculator.NOTCHING_SCORES.get(notching, 0)
        score += TRBSCalculator.DISC_HEMORRHAGE_SCORES.get(disc_hemorrhage, 0)
        return min(score, 8)  # Cap at max domain score
    
    @staticmethod
    def calculate_domain_d(mean_deviation: str, central_field: str) -> int:
        """Calculate Domain D: Functional/Visual Field Changes (0-5)"""
        score = 0
        score += TRBSCalculator.MEAN_DEVIATION_SCORES.get(mean_deviation, 0)
        score += TRBSCalculator.CENTRAL_FIELD_SCORES.get(central_field, 0)
        return min(score, 5)  # Cap at max domain score
    
    @staticmethod
    def calculate_domain_e(cct: str, ocular_modifiers: list) -> int:
        """Calculate Domain E: Ocular Risk Modifiers (0-5)"""
        score = TRBSCalculator.CCT_SCORES.get(cct, 0)
        
        # Add 1 for each present modifier
        for modifier in ocular_modifiers:
            if modifier in TRBSCalculator.OCULAR_MODIFIERS:
                score += 1
        
        return min(score, 5)  # Cap at max domain score
    
    @staticmethod
    def calculate_domain_f(systemic_factors: list) -> int:
        """Calculate Domain F: Systemic Risk Modifiers (0-5)"""
        score = 0
        for factor in systemic_factors:
            if factor in TRBSCalculator.SYSTEMIC_FACTORS:
                score += 1
        return min(score, 5)  # Cap at max domain score
    
    @staticmethod
    def calculate_domain_g(patient_factors: list) -> int:
        """Calculate Domain G: Disease/Patient Factors (0-2)"""
        score = 0
        for factor in patient_factors:
            if factor in TRBSCalculator.PATIENT_FACTORS:
                score += 1
        return min(score, 2)  # Cap at max domain score
    
    @classmethod
    def calculate_single_eye(
        cls,
        eye: str,  # "OD" or "OS"
        baseline_iop: float,
        # Domain A (shared)
        age: str = "50_to_70",
        family_history: str = "absent",
        # Domain B (Baseline IOP)
        num_agm: str = "0",
        # Domain C (per eye - Structural)
        cdr: str = "0.5_or_less",
        notching: str = "absent",
        disc_hemorrhage: str = "absent",
        # Domain D (per eye - Visual Field)
        mean_deviation: str = "0_to_minus_6",
        central_field: str = "no",
        # Domain E (per eye - Ocular Modifiers)
        cct: str = "normal",
        ocular_modifiers: list = None,
        # Domain F (shared - Systemic)
        systemic_factors: list = None,
        # Domain G (shared - Patient Factors)
        patient_factors: list = None,
        # Use aggressive reduction?
        use_aggressive_reduction: bool = False
    ) -> SingleEyeResult:
        """
        Calculate Target IOP for a single eye based on TRBS.
        """
        ocular_modifiers = ocular_modifiers or []
        systemic_factors = systemic_factors or []
        patient_factors = patient_factors or []
        
        # Calculate domain scores
        domain_a = cls.calculate_domain_a(age, family_history)
        domain_b = cls.calculate_domain_b(baseline_iop, num_agm)
        domain_c = cls.calculate_domain_c(cdr, notching, disc_hemorrhage)
        domain_d = cls.calculate_domain_d(mean_deviation, central_field)
        domain_e = cls.calculate_domain_e(cct, ocular_modifiers)
        domain_f = cls.calculate_domain_f(systemic_factors)
        domain_g = cls.calculate_domain_g(patient_factors)
        
        domain_scores = {
            "demographic_risk": domain_a,
            "baseline_iop": domain_b,
            "structural_changes": domain_c,
            "functional_changes": domain_d,
            "ocular_modifiers": domain_e,
            "systemic_factors": domain_f,
            "patient_factors": domain_g
        }
        
        # Calculate total TRBS
        trbs_score = domain_a + domain_b + domain_c + domain_d + domain_e + domain_f + domain_g
        trbs_score = max(0, min(trbs_score, 29))  # Clamp to 0-29
        
        # Get risk tier and reduction parameters
        risk_tier, tier_config = cls.get_risk_tier(trbs_score)
        
        # Determine reduction percentage
        if use_aggressive_reduction:
            reduction_pct = tier_config["reduction_max"]
        else:
            reduction_pct = tier_config["reduction_min"]
        
        # Calculate target IOP (no upper cap)
        calculated_target = cls.calculate_target_iop(baseline_iop, reduction_pct)
        
        return SingleEyeResult(
            eye=eye,
            trbs_score=trbs_score,
            risk_tier=risk_tier.value,
            reduction_percentage_min=tier_config["reduction_min"],
            reduction_percentage_max=tier_config["reduction_max"],
            reduction_applied=reduction_pct,
            baseline_iop=baseline_iop,
            calculated_target=calculated_target,
            final_target=calculated_target,  # Same unless doctor overrides
            domain_scores=domain_scores
        )
    
    @classmethod
    def calculate(
        cls,
        baseline_iop_od: float,
        baseline_iop_os: float,
        # Domain A (shared between eyes)
        age: str = "50_to_70",
        family_history: str = "absent",
        # Domain B - Baseline IOP (shared)
        num_agm: str = "0",
        # Domain C - Right Eye (OD) - Structural
        cdr_od: str = "0.5_or_less",
        notching_od: str = "absent",
        disc_hemorrhage_od: str = "absent",
        # Domain C - Left Eye (OS) - Structural
        cdr_os: str = "0.5_or_less",
        notching_os: str = "absent",
        disc_hemorrhage_os: str = "absent",
        # Domain D - Right Eye (OD) - Visual Field
        mean_deviation_od: str = "0_to_minus_6",
        central_field_od: str = "no",
        # Domain D - Left Eye (OS) - Visual Field
        mean_deviation_os: str = "0_to_minus_6",
        central_field_os: str = "no",
        # Domain E - Right Eye (OD) - Ocular Modifiers
        cct_od: str = "normal",
        ocular_modifiers_od: list = None,
        # Domain E - Left Eye (OS) - Ocular Modifiers
        cct_os: str = "normal",
        ocular_modifiers_os: list = None,
        # Domain F (shared) - Systemic
        systemic_factors: list = None,
        # Domain G (shared) - Patient Factors
        patient_factors: list = None,
        # Use aggressive reduction?
        use_aggressive_reduction: bool = False,
        # Legacy support: single values (will apply to both eyes)
        cdr: str = None,
        notching: str = None,
        disc_hemorrhage: str = None,
        mean_deviation: str = None,
        central_field: str = None,
        cct: str = None,
        ocular_modifiers: list = None
    ) -> TargetIOPResult:
        """
        Calculate Target IOP based on Total Risk Burden Score.
        NOW CALCULATES SEPARATELY FOR EACH EYE.
        
        Args:
            baseline_iop_od: Baseline IOP for right eye (mmHg)
            baseline_iop_os: Baseline IOP for left eye (mmHg)
            ... (all other per-eye parameters)
            
        Returns:
            TargetIOPResult with calculations for both eyes
        """
        # Handle legacy single-value parameters
        if cdr is not None:
            cdr_od = cdr_os = cdr
        if notching is not None:
            notching_od = notching_os = notching
        if disc_hemorrhage is not None:
            disc_hemorrhage_od = disc_hemorrhage_os = disc_hemorrhage
        if mean_deviation is not None:
            mean_deviation_od = mean_deviation_os = mean_deviation
        if central_field is not None:
            central_field_od = central_field_os = central_field
        if cct is not None:
            cct_od = cct_os = cct
        if ocular_modifiers is not None:
            ocular_modifiers_od = ocular_modifiers_os = ocular_modifiers
        
        # Initialize lists
        ocular_modifiers_od = ocular_modifiers_od or []
        ocular_modifiers_os = ocular_modifiers_os or []
        systemic_factors = systemic_factors or []
        patient_factors = patient_factors or []
        
        # Calculate for RIGHT EYE (OD)
        od_result = cls.calculate_single_eye(
            eye="OD",
            baseline_iop=baseline_iop_od,
            age=age,
            family_history=family_history,
            num_agm=num_agm,
            cdr=cdr_od,
            notching=notching_od,
            disc_hemorrhage=disc_hemorrhage_od,
            mean_deviation=mean_deviation_od,
            central_field=central_field_od,
            cct=cct_od,
            ocular_modifiers=ocular_modifiers_od,
            systemic_factors=systemic_factors,
            patient_factors=patient_factors,
            use_aggressive_reduction=use_aggressive_reduction
        )
        
        # Calculate for LEFT EYE (OS)
        os_result = cls.calculate_single_eye(
            eye="OS",
            baseline_iop=baseline_iop_os,
            age=age,
            family_history=family_history,
            num_agm=num_agm,
            cdr=cdr_os,
            notching=notching_os,
            disc_hemorrhage=disc_hemorrhage_os,
            mean_deviation=mean_deviation_os,
            central_field=central_field_os,
            cct=cct_os,
            ocular_modifiers=ocular_modifiers_os,
            systemic_factors=systemic_factors,
            patient_factors=patient_factors,
            use_aggressive_reduction=use_aggressive_reduction
        )
        
        # For backward compatibility, use the higher (worse) risk values
        max_trbs = max(od_result.trbs_score, os_result.trbs_score)
        risk_tier, tier_config = cls.get_risk_tier(max_trbs)
        
        return TargetIOPResult(
            od_result=od_result,
            os_result=os_result,
            # Legacy fields
            trbs_score=max_trbs,
            risk_tier=risk_tier.value,
            reduction_percentage_min=tier_config["reduction_min"],
            reduction_percentage_max=tier_config["reduction_max"],
            target_iop_od=od_result.calculated_target,
            target_iop_os=os_result.calculated_target,
            baseline_iop_od=baseline_iop_od,
            baseline_iop_os=baseline_iop_os,
            domain_scores=od_result.domain_scores  # Use OD as reference
        )


# Convenience function for API use
def calculate_target_iop(
    baseline_iop_od: float,
    baseline_iop_os: float,
    risk_factors: Dict
) -> Dict:
    """
    API-friendly wrapper for TRBS calculation.
    
    Args:
        baseline_iop_od: Baseline IOP for right eye
        baseline_iop_os: Baseline IOP for left eye
        risk_factors: Dictionary containing all risk factor values
        
    Returns:
        Dictionary with calculation results for both eyes
    """
    result = TRBSCalculator.calculate(
        baseline_iop_od=baseline_iop_od,
        baseline_iop_os=baseline_iop_os,
        # Domain A (shared)
        age=risk_factors.get("age", "50_to_70"),
        family_history=risk_factors.get("family_history", "absent"),
        # Domain B - Baseline IOP (shared)
        num_agm=risk_factors.get("num_agm", "0"),
        # Domain C - Structural per eye
        cdr_od=risk_factors.get("cdr_od", risk_factors.get("cdr", "0.5_or_less")),
        notching_od=risk_factors.get("notching_od", risk_factors.get("notching", "absent")),
        disc_hemorrhage_od=risk_factors.get("disc_hemorrhage_od", risk_factors.get("disc_hemorrhage", "absent")),
        cdr_os=risk_factors.get("cdr_os", risk_factors.get("cdr", "0.5_or_less")),
        notching_os=risk_factors.get("notching_os", risk_factors.get("notching", "absent")),
        disc_hemorrhage_os=risk_factors.get("disc_hemorrhage_os", risk_factors.get("disc_hemorrhage", "absent")),
        # Domain D - Visual Field per eye
        mean_deviation_od=risk_factors.get("mean_deviation_od", risk_factors.get("mean_deviation", "0_to_minus_6")),
        central_field_od=risk_factors.get("central_field_od", risk_factors.get("central_field", "no")),
        mean_deviation_os=risk_factors.get("mean_deviation_os", risk_factors.get("mean_deviation", "0_to_minus_6")),
        central_field_os=risk_factors.get("central_field_os", risk_factors.get("central_field", "no")),
        # Domain E - Ocular Modifiers per eye
        cct_od=risk_factors.get("cct_od", risk_factors.get("cct", "normal")),
        ocular_modifiers_od=risk_factors.get("ocular_modifiers_od", risk_factors.get("ocular_modifiers", [])),
        cct_os=risk_factors.get("cct_os", risk_factors.get("cct", "normal")),
        ocular_modifiers_os=risk_factors.get("ocular_modifiers_os", risk_factors.get("ocular_modifiers", [])),
        # Domain F & G (shared)
        systemic_factors=risk_factors.get("systemic_factors", []),
        patient_factors=risk_factors.get("patient_factors", []),
        use_aggressive_reduction=risk_factors.get("use_aggressive_reduction", False)
    )
    
    return {
        # Per-eye detailed results
        "od_result": {
            "eye": result.od_result.eye,
            "trbs_score": result.od_result.trbs_score,
            "risk_tier": result.od_result.risk_tier,
            "reduction_percentage_min": result.od_result.reduction_percentage_min,
            "reduction_percentage_max": result.od_result.reduction_percentage_max,
            "reduction_applied": result.od_result.reduction_applied,
            "baseline_iop": result.od_result.baseline_iop,
            "calculated_target": result.od_result.calculated_target,
            "final_target": result.od_result.final_target,
            "domain_scores": result.od_result.domain_scores
        },
        "os_result": {
            "eye": result.os_result.eye,
            "trbs_score": result.os_result.trbs_score,
            "risk_tier": result.os_result.risk_tier,
            "reduction_percentage_min": result.os_result.reduction_percentage_min,
            "reduction_percentage_max": result.os_result.reduction_percentage_max,
            "reduction_applied": result.os_result.reduction_applied,
            "baseline_iop": result.os_result.baseline_iop,
            "calculated_target": result.os_result.calculated_target,
            "final_target": result.os_result.final_target,
            "domain_scores": result.os_result.domain_scores
        },
        # Legacy fields for backward compatibility
        "trbs_score": result.trbs_score,
        "risk_tier": result.risk_tier,
        "reduction_percentage_min": result.reduction_percentage_min,
        "reduction_percentage_max": result.reduction_percentage_max,
        "target_iop_od": result.target_iop_od,
        "target_iop_os": result.target_iop_os,
        "baseline_iop_od": result.baseline_iop_od,
        "baseline_iop_os": result.baseline_iop_os,
        "domain_scores": result.domain_scores
    }
