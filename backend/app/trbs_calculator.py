"""
Target IOP Calculation based on Total Risk Burden Score (TRBS)

This module calculates individual target IOP based on comprehensive risk assessment
across 7 domains - CALCULATED SEPARATELY FOR EACH EYE:
- A. Demographic Risk (1-4)
- B. Baseline IOP (0-4)
- C. Structural Changes (0-9) - per eye (CDR + Notching + RNFL + Disc Hemorrhage)
- D. Functional/Visual Field Changes (0-6) - per eye
- E. Disease/Patient Factors (0-3) - shared
- F. Ocular Risk Modifiers (0-8) - per eye
- G. Systemic Risk Modifiers (0-5) - shared

Total TRBS Range: 0-39
Total risk burden score = Sum of risk factors (Range: 0-26) + sum of all risk modifiers
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
    - 1-6 (Low): 20-25% reduction (EMGT/OHTS)
    - 7-12 (Moderate): 30-35% reduction (CNGTS)
    - 13-18 (High): 40-45% reduction (AGIS)
    - ≥19 (Very High): ≥50% reduction (aim ≤12 mmHg)
    """
    
    # Domain A: Demographic Risk (1-4) - MIN is 1, not 0 (age always contributes)
    AGE_SCORES = {
        "over_70": 1,
        "50_to_70": 2,
        "under_50": 3
    }
    
    FAMILY_HISTORY_SCORES = {
        "absent": 0,
        "present": 1
    }
    
    # Domain B: Baseline IOP (0-4) - Untreated IOP
    # <22mmHg = 0, 22 to <24 = 1, 24 to <26 = 2, 26 to <28 = 3, 28 to ≤30 = 4
    # Note: >30 is still scored as 4, but triggers upper cap logic
    BASELINE_IOP_SCORES = {
        "less_than_22": 0,
        "22_to_24": 1,
        "24_to_26": 2,
        "26_to_28": 3,
        "28_to_30_or_more": 4  # Includes 28 to ≤30, and >30 (but >30 uses upper cap)
    }
    
    # AGM adjustment for baseline IOP
    AGM_ADJUSTMENT = {
        "0": 0,
        "1": 5,
        "2": 8,
        "3_or_more": 10
    }
    
    # Domain C: Structural Changes (0-9)
    # Vertical CDR (0-4) + Focal Notching (0-3) + RNFL Defect (0-1) + Disc Hemorrhage (0-1)
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
    
    RNFL_DEFECT_SCORES = {
        "absent": 0,
        "present": 1
    }
    
    DISC_HEMORRHAGE_SCORES = {
        "absent": 0,
        "present": 1
    }
    
    # Domain D: Functional/Visual Field Changes (0-6)
    # HFA not done in first visit = 0, ≥-6 dB = 1, -6.01 to -12 = 2, -12.01 to -20 = 3, <-20.01 dB = 4, HFA not possible = 4
    MEAN_DEVIATION_SCORES = {
        "hfa_not_done": 0,
        "greater_than_minus_6": 1,  # ≥-6 dB
        "minus_6_to_minus_12": 2,   # -6.01 to -12 dB
        "minus_12_to_minus_20": 3,  # -12.01 to -20 dB
        "less_than_minus_20": 4,    # <-20.01 dB
        "hfa_not_possible": 4
    }
    
    CENTRAL_FIELD_SCORES = {
        "no": 0,
        "yes": 2
    }
    
    # Domain F: Ocular Risk Modifiers (0-8)
    # Thin CCT (<500 µm) = 1, Low myopia (-1DS to -3DS) without cataract = 1,
    # Mod to high myopia (<-3DS) without cataract = 2, Angle recession >180 deg = 1,
    # Pseudoexfoliation = 1, Pigment dispersion = 1, Steroid responder = 1
    CCT_SCORES = {
        "normal": 0,      # ≥500 µm
        "thin": 1         # <500 µm
    }
    
    MYOPIA_SCORES = {
        "none": 0,
        "low_myopia": 1,      # -1DS to -3DS without cataract
        "mod_high_myopia": 2  # <-3DS without cataract
    }
    
    # Boolean modifiers (each adds 1 if present)
    OCULAR_MODIFIERS = ["angle_recession", "pseudoexfoliation", "pigment_dispersion", "steroid_responder"]
    
    # Domain G: Systemic Risk Modifiers (0-5)
    # Low ocular perfusion pressure (DOPP <50mm Hg) = 1, Migraine/vasospasm = 1,
    # Raynaud's = 1, Sleep apnea = 1, Diabetes mellitus = 1
    SYSTEMIC_FACTORS = [
        "low_ocular_perfusion",
        "migraine_vasospasm",
        "raynauds",
        "sleep_apnea",
        "diabetes_mellitus"
    ]
    
    # Domain E: Disease/Patient Factors (0-3)
    # None = 0, One-eyed patient/Advanced disease in fellow eye = 2, Poor compliance/follow-up = 1
    PATIENT_FACTOR_SCORES = {
        "one_eyed_or_advanced_fellow": 2,
        "poor_compliance": 1
    }
    
    PATIENT_FACTORS = [
        "one_eyed_or_advanced_fellow",
        "poor_compliance"
    ]
    
    # Upper cap based on vertical CDR when baseline IOP > 30mmHg
    # If baseline IOP > 30mm Hg, use absolute upper cap:
    # ≤0.5: ≤18mm Hg
    # 0.6: 16-18mm Hg (use 18 as max)
    # 0.7: 14-16mm Hg (use 16 as max)
    # 0.8: 12-14mm Hg (use 14 as max)
    # ≥0.9: ≤12 mm Hg
    CDR_UPPER_CAP = {
        "0.5_or_less": 18,  # ≤18mm Hg
        "0.6": 18,          # 16-18mm Hg (max is 18)
        "0.7": 16,          # 14-16mm Hg (max is 16)
        "0.8": 14,          # 12-14mm Hg (max is 14)
        "0.9_or_more": 12   # ≤12 mm Hg
    }
    
    # Risk tier definitions (reduction percentages based on TRBS score)
    # TRBS 1-6: Low → 20-25% (EMGT/OHTS)
    # TRBS 7-12: Moderate → 30-35% (CNGTS)
    # TRBS 13-18: High → 40-45% (AGIS)
    # TRBS ≥19: Very High → ≥50% (aim ≤12 mmHg)
    RISK_TIERS = {
        RiskTier.LOW: {
            "min_score": 1,
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
            "max_score": 39,
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
        """Calculate Domain A: Demographic Risk (1-4)
        
        Min domain score is 1 (age always contributes at least 1 point)
        Max domain score is 4
        """
        score = 0
        score += TRBSCalculator.AGE_SCORES.get(age, 2)  # Default to 50-70 if not specified
        score += TRBSCalculator.FAMILY_HISTORY_SCORES.get(family_history, 0)
        return max(1, min(score, 4))  # Min is 1, max is 4
    
    @staticmethod
    def calculate_domain_b(baseline_iop: float, num_agm: str = "0") -> int:
        """Calculate Domain B: Baseline IOP (0-4)
        
        If patient is on AGM treatment, add adjustment to current IOP
        to estimate untreated baseline.
        
        Untreated IOP ranges:
        - <22mmHg = 0
        - 22 to <24 = 1
        - 24 to <26 = 2
        - 26 to <28 = 3
        - 28 to ≤30mmHg = 4
        """
        # Add AGM adjustment to get untreated baseline estimate
        agm_adj = TRBSCalculator.AGM_ADJUSTMENT.get(num_agm, 0)
        untreated_iop = baseline_iop + agm_adj
        
        # Determine score based on untreated IOP
        # <22mmHg = 0, 22 to <24 = 1, 24 to <26 = 2, 26 to <28 = 3, 28 to ≤30 = 4
        if untreated_iop < 22:
            return 0
        elif untreated_iop < 24:  # 22 to <24
            return 1
        elif untreated_iop < 26:  # 24 to <26
            return 2
        elif untreated_iop < 28:  # 26 to <28
            return 3
        else:  # 28 to ≤30 (and >30, but >30 uses upper cap)
            return 4
    
    @staticmethod
    def calculate_domain_c(cdr: str, notching: str, rnfl_defect: str, disc_hemorrhage: str) -> int:
        """Calculate Domain C: Structural Changes (0-9)
        
        - Vertical CDR: 0-4 pts
        - Focal Notching: 0-3 pts
        - RNFL Defect: 0-1 pt
        - Disc Hemorrhage: 0-1 pt
        """
        score = 0
        score += TRBSCalculator.CDR_SCORES.get(cdr, 0)
        score += TRBSCalculator.NOTCHING_SCORES.get(notching, 0)
        score += TRBSCalculator.RNFL_DEFECT_SCORES.get(rnfl_defect, 0)
        score += TRBSCalculator.DISC_HEMORRHAGE_SCORES.get(disc_hemorrhage, 0)
        return min(score, 9)  # Cap at max domain score
    
    @staticmethod
    def calculate_domain_d(mean_deviation: str, central_field: str) -> int:
        """Calculate Domain D: Functional/Visual Field Changes (0-6)
        
        - Mean Deviation: 0-4 pts
        - Central Field Involvement (5 degrees): 0-2 pts
        """
        score = 0
        score += TRBSCalculator.MEAN_DEVIATION_SCORES.get(mean_deviation, 0)
        score += TRBSCalculator.CENTRAL_FIELD_SCORES.get(central_field, 0)
        return min(score, 6)  # Cap at max domain score
    
    @staticmethod
    def calculate_domain_e(patient_factors: list) -> int:
        """Calculate Domain E: Disease/Patient Factors (0-3)
        
        - None = 0
        - One-eyed patient / Advanced disease in fellow eye = 2
        - Poor compliance / follow-up = 1
        """
        score = 0
        for factor in patient_factors:
            if factor in TRBSCalculator.PATIENT_FACTOR_SCORES:
                score += TRBSCalculator.PATIENT_FACTOR_SCORES[factor]
        return min(score, 3)  # Cap at max domain score
    
    @staticmethod
    def calculate_domain_f_ocular(cct: str, myopia: str, ocular_modifiers: list) -> int:
        """Calculate Domain F: Ocular Risk Modifiers (0-8)
        
        - Thin CCT (<500 µm) = 1
        - Low myopia (-1DS to -3DS) without cataract = 1
        - Mod to high myopia (<-3DS) without cataract = 2
        - Angle recession >180 deg = 1
        - Pseudoexfoliation = 1
        - Pigment dispersion = 1
        - Steroid responder = 1
        """
        score = TRBSCalculator.CCT_SCORES.get(cct, 0)
        score += TRBSCalculator.MYOPIA_SCORES.get(myopia, 0)
        
        # Add 1 for each present modifier
        for modifier in ocular_modifiers:
            if modifier in TRBSCalculator.OCULAR_MODIFIERS:
                score += 1
        
        return min(score, 8)  # Cap at max domain score
    
    @staticmethod
    def calculate_domain_g_systemic(systemic_factors: list) -> int:
        """Calculate Domain G: Systemic Risk Modifiers (0-5)
        
        - Low ocular perfusion pressure (DOPP <50mm Hg) = 1
        - Migraine / vasospasm = 1
        - Raynaud's = 1
        - Sleep apnea = 1
        - Diabetes mellitus = 1
        """
        score = 0
        for factor in systemic_factors:
            if factor in TRBSCalculator.SYSTEMIC_FACTORS:
                score += 1
        return min(score, 5)  # Cap at max domain score
    
    @staticmethod
    def get_upper_cap_for_cdr(cdr: str, baseline_iop: float) -> float:
        """Get upper cap target IOP based on CDR when baseline > 30mmHg.
        
        If baseline IOP > 30mm Hg, use absolute upper cap based on CDR:
        - ≤0.5: ≤18mm Hg
        - 0.6: 16-18mm Hg (use 18 as max)
        - 0.7: 14-16mm Hg (use 16 as max)
        - 0.8: 12-14mm Hg (use 14 as max)
        - ≥0.9: ≤12 mm Hg
        """
        if baseline_iop <= 30:
            return None  # No cap applies
        return TRBSCalculator.CDR_UPPER_CAP.get(cdr, 18)
    
    @staticmethod
    def calculate_followup_target_iop(
        current_iop: float,
        baseline_iop: float,
        reduction_percentage: int,
        cdr: str
    ) -> float:
        """
        Calculate target IOP for follow-up visit.
        
        Formula: min(% reduction based on current visit IOP and MD risk score vs upper cap)
        
        Args:
            current_iop: Current visit IOP (from investigation)
            baseline_iop: Original baseline IOP (for upper cap check)
            reduction_percentage: Reduction percentage from TRBS
            cdr: Cup-to-disc ratio (for upper cap)
            
        Returns:
            Target IOP for follow-up visit
        """
        # Calculate target based on current IOP with reduction percentage
        target_from_current = current_iop * (1 - reduction_percentage / 100)
        
        # Get upper cap if baseline > 30mmHg
        upper_cap = TRBSCalculator.get_upper_cap_for_cdr(cdr, baseline_iop)
        
        # Return minimum of calculated target and upper cap
        if upper_cap is not None:
            return min(target_from_current, upper_cap)
        
        return target_from_current
    
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
        rnfl_defect: str = "absent",
        disc_hemorrhage: str = "absent",
        # Domain D (per eye - Visual Field)
        mean_deviation: str = "hfa_not_done",
        central_field: str = "no",
        # Domain E (shared - Patient Factors)
        patient_factors: list = None,
        # Domain F (per eye - Ocular Modifiers)
        cct: str = "normal",
        myopia: str = "none",
        ocular_modifiers: list = None,
        # Domain G (shared - Systemic)
        systemic_factors: list = None,
        # Use aggressive reduction?
        use_aggressive_reduction: bool = False
    ) -> SingleEyeResult:
        """
        Calculate Target IOP for a single eye based on TRBS.
        
        Domains:
        - A. Demographic Risk (1-4) - shared
        - B. Baseline IOP (0-4) - shared
        - C. Structural Changes (0-9) - per eye
        - D. Functional/Visual Field Changes (0-6) - per eye
        - E. Disease/Patient Factors (0-3) - shared
        - F. Ocular Risk Modifiers (0-8) - per eye
        - G. Systemic Risk Modifiers (0-5) - shared
        """
        ocular_modifiers = ocular_modifiers or []
        systemic_factors = systemic_factors or []
        patient_factors = patient_factors or []
        
        # Calculate domain scores
        domain_a = cls.calculate_domain_a(age, family_history)
        domain_b = cls.calculate_domain_b(baseline_iop, num_agm)
        domain_c = cls.calculate_domain_c(cdr, notching, rnfl_defect, disc_hemorrhage)
        domain_d = cls.calculate_domain_d(mean_deviation, central_field)
        domain_e = cls.calculate_domain_e(patient_factors)
        domain_f = cls.calculate_domain_f_ocular(cct, myopia, ocular_modifiers)
        domain_g = cls.calculate_domain_g_systemic(systemic_factors)
        
        domain_scores = {
            "demographic_risk": domain_a,
            "baseline_iop": domain_b,
            "structural_changes": domain_c,
            "functional_changes": domain_d,
            "patient_factors": domain_e,
            "ocular_modifiers": domain_f,
            "systemic_factors": domain_g
        }
        
        # Calculate total TRBS
        # Total = Sum of risk factors (Range: 0-26) + sum of all risk modifiers
        # Risk factors: Domain A (1-4) + Domain B (0-4) + Domain C (0-9) + Domain D (0-6) + Domain E (0-3) = 0-26
        # Risk modifiers: Domain F (0-8) + Domain G (0-5) = 0-13
        # Total range: 0-39, but Domain A minimum is 1, so minimum TRBS is 1
        trbs_score = domain_a + domain_b + domain_c + domain_d + domain_e + domain_f + domain_g
        trbs_score = max(1, min(trbs_score, 39))  # Clamp to 1-39 (min is 1 because Domain A min is 1)
        
        # Get risk tier and reduction parameters
        risk_tier, tier_config = cls.get_risk_tier(trbs_score)
        
        # Determine reduction percentage
        if use_aggressive_reduction:
            reduction_pct = tier_config["reduction_max"]
        else:
            reduction_pct = tier_config["reduction_min"]
        
        # Calculate target IOP
        calculated_target = cls.calculate_target_iop(baseline_iop, reduction_pct)
        
        # Apply upper cap if baseline > 30mmHg (based on CDR)
        upper_cap = cls.get_upper_cap_for_cdr(cdr, baseline_iop)
        if upper_cap is not None and calculated_target > upper_cap:
            calculated_target = upper_cap
        
        # For Very High risk, ensure target is ≤12 mmHg
        if risk_tier == RiskTier.VERY_HIGH and calculated_target > 12:
            calculated_target = 12.0
        
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
        rnfl_defect_od: str = "absent",
        disc_hemorrhage_od: str = "absent",
        # Domain C - Left Eye (OS) - Structural
        cdr_os: str = "0.5_or_less",
        notching_os: str = "absent",
        rnfl_defect_os: str = "absent",
        disc_hemorrhage_os: str = "absent",
        # Domain D - Right Eye (OD) - Visual Field
        mean_deviation_od: str = "hfa_not_done",
        central_field_od: str = "no",
        # Domain D - Left Eye (OS) - Visual Field
        mean_deviation_os: str = "hfa_not_done",
        central_field_os: str = "no",
        # Domain E (shared) - Patient Factors
        patient_factors: list = None,
        # Domain F - Right Eye (OD) - Ocular Modifiers
        cct_od: str = "normal",
        myopia_od: str = "none",
        ocular_modifiers_od: list = None,
        # Domain F - Left Eye (OS) - Ocular Modifiers
        cct_os: str = "normal",
        myopia_os: str = "none",
        ocular_modifiers_os: list = None,
        # Domain G (shared) - Systemic
        systemic_factors: list = None,
        # Use aggressive reduction?
        use_aggressive_reduction: bool = False,
        # Legacy support: single values (will apply to both eyes)
        cdr: str = None,
        notching: str = None,
        rnfl_defect: str = None,
        disc_hemorrhage: str = None,
        mean_deviation: str = None,
        central_field: str = None,
        cct: str = None,
        myopia: str = None,
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
        if rnfl_defect is not None:
            rnfl_defect_od = rnfl_defect_os = rnfl_defect
        if disc_hemorrhage is not None:
            disc_hemorrhage_od = disc_hemorrhage_os = disc_hemorrhage
        if mean_deviation is not None:
            mean_deviation_od = mean_deviation_os = mean_deviation
        if central_field is not None:
            central_field_od = central_field_os = central_field
        if cct is not None:
            cct_od = cct_os = cct
        if myopia is not None:
            myopia_od = myopia_os = myopia
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
            rnfl_defect=rnfl_defect_od,
            disc_hemorrhage=disc_hemorrhage_od,
            mean_deviation=mean_deviation_od,
            central_field=central_field_od,
            patient_factors=patient_factors,
            cct=cct_od,
            myopia=myopia_od,
            ocular_modifiers=ocular_modifiers_od,
            systemic_factors=systemic_factors,
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
            rnfl_defect=rnfl_defect_os,
            disc_hemorrhage=disc_hemorrhage_os,
            mean_deviation=mean_deviation_os,
            central_field=central_field_os,
            patient_factors=patient_factors,
            cct=cct_os,
            myopia=myopia_os,
            ocular_modifiers=ocular_modifiers_os,
            systemic_factors=systemic_factors,
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
        cdr_od=risk_factors.get("cdr_od", "0.5_or_less"),
        notching_od=risk_factors.get("notching_od", "absent"),
        rnfl_defect_od=risk_factors.get("rnfl_defect_od", "absent"),
        disc_hemorrhage_od=risk_factors.get("disc_hemorrhage_od", "absent"),
        cdr_os=risk_factors.get("cdr_os", "0.5_or_less"),
        notching_os=risk_factors.get("notching_os", "absent"),
        rnfl_defect_os=risk_factors.get("rnfl_defect_os", "absent"),
        disc_hemorrhage_os=risk_factors.get("disc_hemorrhage_os", "absent"),
        # Domain D - Visual Field per eye
        mean_deviation_od=risk_factors.get("mean_deviation_od", "hfa_not_done"),
        central_field_od=risk_factors.get("central_field_od", "no"),
        mean_deviation_os=risk_factors.get("mean_deviation_os", "hfa_not_done"),
        central_field_os=risk_factors.get("central_field_os", "no"),
        # Domain E - Patient Factors (shared)
        patient_factors=risk_factors.get("patient_factors", []),
        # Domain F - Ocular Modifiers per eye
        cct_od=risk_factors.get("cct_od", "normal"),
        myopia_od=risk_factors.get("myopia_od", "none"),
        ocular_modifiers_od=risk_factors.get("ocular_modifiers_od", []),
        cct_os=risk_factors.get("cct_os", "normal"),
        myopia_os=risk_factors.get("myopia_os", "none"),
        ocular_modifiers_os=risk_factors.get("ocular_modifiers_os", []),
        # Domain G - Systemic (shared)
        systemic_factors=risk_factors.get("systemic_factors", []),
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
