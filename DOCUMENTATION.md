# Glaucoma IOP Monitor - Complete System Documentation

## Executive Summary

**Glaucoma IOP Monitor** is a clinical decision support system designed to **individualize target intraocular pressure (IOP) for glaucoma patients**. The system implements evidence-based algorithms from landmark clinical studies (EMGT, OHTS, CNGTS, AGIS) to calculate per-eye target pressures based on comprehensive risk assessment.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Clinical Concept](#2-core-clinical-concept)
3. [System Architecture](#3-system-architecture)
4. [Backend API Documentation](#4-backend-api-documentation)
5. [Frontend Components](#5-frontend-components)
6. [Database Schema](#6-database-schema)
7. [Algorithms & Calculations](#7-algorithms--calculations)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [Setup & Installation](#9-setup--installation)
10. [File Structure](#10-file-structure)

---

## 1. Overview

### 1.1 Purpose

Glaucoma is a progressive optic neuropathy where **IOP is the only modifiable risk factor**. The goal of treatment is to lower IOP to a level that prevents further optic nerve damage. This "target IOP" varies significantly between patients based on their individual risk profile.

This software automates the complex calculation of individualized target IOP using the **Total Risk Burden Score (TRBS)** methodology, providing:

- **Per-eye target IOP calculation** (OD and OS independently)
- **Real-time risk assessment** with clinical recommendations
- **Progress monitoring** with 3-month measurement validity checks
- **Automated follow-up scheduling** based on risk stratification

### 1.2 Key Features

| Feature | Description |
|---------|-------------|
| **Per-Eye TRBS Calculation** | Each eye receives independent risk assessment and target pressure |
| **Glaucoma Stage Caps** | Targets capped based on disease stage (EARLY ≤18, ADVANCED ≤14, END_STAGE ≤12 mmHg) |
| **6-Domain Risk Assessment** | Demographic, Structural, Functional, Ocular, Systemic, and Disease factors |
| **Real-Time Risk Monitoring** | Continuous evaluation of IOP control, RNFL progression, and VF changes |
| **Clinical Decision Support** | Automated follow-up recommendations based on risk level |
| **Measurement Validity** | Alerts when measurements are >3 months old |

---

## 2. Core Clinical Concept

### 2.1 Why Individualized Target IOP?

Traditional "one-size-fits-all" IOP targets (e.g., <21 mmHg) are inadequate because:

1. **Normal-Tension Glaucoma**: Damage occurs even at "normal" pressures
2. **Risk Variation**: A 65-year-old with family history needs lower targets than a 45-year-old without risk factors
3. **Disease Progression**: Advanced disease requires more aggressive pressure control
4. **Per-Eye Differences**: The same patient may have different disease severity in each eye

### 2.2 Evidence-Based Upper Caps

| Glaucoma Stage | Maximum Target IOP | Evidence Source |
|----------------|-------------------|-----------------|
| EARLY | ≤18 mmHg | EMGT, OHTS studies |
| NORMAL_TENSION | ≤16 mmHg | CNGTS study |
| ADVANCED | ≤14 mmHg | AGIS study |
| END_STAGE | ≤12 mmHg | Clinical consensus |

### 2.3 TRBS Risk Tiers

| TRBS Score | Risk Tier | IOP Reduction |
|------------|-----------|---------------|
| 0-6 | Low | 20-25% |
| 7-12 | Moderate | 30-35% |
| 13-18 | High | 40-45% |
| 19-25 | Very High | ≥50% |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│              React 19 + Vite (Port 5174)                        │
├─────────────────────────────────────────────────────────────────┤
│  PatientList → PatientDashboard → RiskAssessmentPanel           │
│                      ↓                                          │
│  TargetIOPCalculator → TRBS Form → Per-Eye Results              │
│                      ↓                                          │
│  MeasurementForm → IOP + OCT RNFL + VF MD Recording             │
│                      ↓                                          │
│  TrendChart → Historical Visualization                          │
└─────────────────────────────────────────────────────────────────┘
                            │ HTTP API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│              FastAPI + Python 3.13 (Port 8000)                  │
├─────────────────────────────────────────────────────────────────┤
│  Routes:                                                        │
│  ├── /api/patients/*     - Patient CRUD                         │
│  ├── /api/measurements/* - IOP/OCT/VF recording                 │
│  ├── /api/targets/*      - Target IOP management                │
│  └── /api/risk/*         - Risk assessment engine               │
├─────────────────────────────────────────────────────────────────┤
│  Core Engines:                                                  │
│  ├── trbs_calculator.py  - TRBS algorithm (per-eye)             │
│  └── risk_engine.py      - Risk stratification logic            │
└─────────────────────────────────────────────────────────────────┘
                            │ SQLAlchemy ORM
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│              MySQL 8.0 (glaucoma_db)                            │
├─────────────────────────────────────────────────────────────────┤
│  Tables:                                                        │
│  ├── patients           - Patient demographics                  │
│  ├── iop_measurements   - IOP, OCT RNFL, VF MD records         │
│  ├── target_pressures   - Per-eye targets with TRBS data       │
│  └── visits             - Clinical visit records                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Backend API Documentation

### 4.1 Core Modules

#### `trbs_calculator.py` - Target IOP Calculator

**Purpose**: Calculates individualized target IOP for each eye based on Total Risk Burden Score.

**Input**: Risk factors across 6 domains + baseline IOP + glaucoma stage (per eye)

**Output**: `TargetIOPResult` with:
- Per-eye TRBS scores
- Per-eye risk tiers
- Per-eye calculated targets
- Per-eye final targets (with upper cap applied)

**Algorithm Flow**:
```
1. Calculate TRBS Score (sum of 6 domains)
   ├── A. Demographic Risk (0-3)
   ├── B. Structural Changes - per eye (0-7)
   ├── C. Functional/VF Changes - per eye (0-4)
   ├── D. Ocular Risk Modifiers - per eye (-1 to 4)
   ├── E. Systemic Risk Factors (0-5)
   └── F. Disease/Patient Factors (0-3)

2. Determine Risk Tier from TRBS Score
   └── Map to IOP reduction percentage

3. Apply Reduction to Baseline IOP
   └── calculated_target = baseline × (1 - reduction%)

4. Apply Glaucoma Stage Upper Cap
   └── final_target = min(calculated_target, stage_cap)
```

#### `risk_engine.py` - Risk Stratification Engine

**Purpose**: Evaluates patient's current clinical status and generates risk score with recommendations.

**Components**:

| Function | Purpose | Output |
|----------|---------|--------|
| `evaluate_iop_status()` | Compare measured vs target IOP | Status + severity (0-30) |
| `assess_rnfl_progression()` | Detect OCT RNFL thinning | Status + severity (0-25) |
| `assess_vf_progression()` | Detect VF MD deterioration | Status + severity (0-25) |
| `calculate_risk_score()` | Aggregate all factors | Risk level + score (0-100) |
| `recommend_followup()` | Generate clinical actions | Days + action list |

**IOP Evaluation Logic**:
```python
# Proportional tolerance (15% of target, min 2 mmHg)
tolerance = max(2.0, target_iop * 0.15)

# Status determination
if |measured - target| <= tolerance → WITHIN_TARGET
if measured > target + tolerance → ABOVE_TARGET  
if measured < target - tolerance → BELOW_TARGET
```

**VF Progression Logic**:
```python
# MD values are negative (more negative = worse)
# Example: -6 dB → -9 dB = WORSENING (3 dB loss)
annual_change = (current_md - previous_md) / months × 12

if annual_change < -1.0 → PROGRESSIVE (worsening)
if annual_change < -0.5 → MARGINAL
else → STABLE
```

### 4.2 Data Models

#### Patient Model
```python
class Patient:
    id: int (PK)
    patient_id: str (unique, e.g., "GL-2024-001")
    name: str
    date_of_birth: date
    gender: str
    diagnosis: str (e.g., "POAG", "NTG", "ACG")
    diagnosis_date: date
    baseline_iop_od: float
    baseline_iop_os: float
    glaucoma_stage_od: str  # EARLY, NORMAL_TENSION, ADVANCED, END_STAGE
    glaucoma_stage_os: str
    family_history: bool
    race: str
```

#### IOP Measurement Model
```python
class IOPMeasurement:
    id: int (PK)
    patient_id: int (FK)
    measurement_date: datetime
    iop_od: float (mmHg)
    iop_os: float (mmHg)
    device_type: str (e.g., "Goldmann", "Tonopen")
    measured_by: str
    oct_rnfl_od: float (microns, optional)
    oct_rnfl_os: float (microns, optional)
    vf_md_od: float (dB, optional)
    vf_md_os: float (dB, optional)
    clinical_notes: str
```

#### Target Pressure Model
```python
class TargetPressure:
    id: int (PK)
    patient_id: int (FK)
    target_iop_od: float
    target_iop_os: float
    is_overridden_od: str ("true"/"false")
    is_overridden_os: str ("true"/"false")
    trbs_score_od: int
    trbs_score_os: int
    risk_tier_od: str
    risk_tier_os: str
    trbs_data: JSON (full TRBS calculation details)
    created_at: datetime
    created_by: str
```

---

## 5. Frontend Components

### 5.1 Component Hierarchy

```
App.jsx
├── PatientList.jsx          # Patient selection screen
└── PatientDashboard.jsx     # Main patient view
    ├── Tab: Overview
    │   ├── PatientInfo (inline)
    │   ├── TargetIOPDisplay.jsx    # Current targets vs measurements
    │   └── TrendChart.jsx          # Historical IOP graph
    ├── Tab: Target IOP
    │   └── TargetIOPCalculator.jsx # TRBS form + calculation
    ├── Tab: Measurements
    │   └── MeasurementForm.jsx     # Record new IOP/OCT/VF
    ├── Tab: Risk
    │   └── RiskAssessmentPanel.jsx # Risk score + recommendations
    └── Tab: Visits
        └── VisitForm.jsx           # Record clinical visits
```

### 5.2 Component Descriptions

#### `PatientList.jsx`
- Displays all patients in a searchable list
- Shows quick status indicators (risk level badges)
- Click to navigate to patient dashboard

#### `PatientDashboard.jsx`
- Main patient management interface
- Tab-based navigation for different clinical functions
- Displays 3-month measurement validity reminder
- Coordinates data refresh across child components

#### `TargetIOPCalculator.jsx`
- **TRBS Assessment Form** with all 6 risk domains
- Per-eye inputs for:
  - Baseline IOP
  - Glaucoma stage
  - Structural changes (cup-to-disc ratio, RNFL thickness)
  - Functional changes (VF MD)
  - Ocular modifiers (CCT, myopia, PXF)
- Real-time TRBS calculation
- Override capability for clinical judgment
- Displays both eyes' results side-by-side

#### `RiskAssessmentPanel.jsx`
- 4-column grid showing:
  - Risk Level (LOW/MODERATE/HIGH)
  - Risk Score (0-100)
  - IOP Control Status
  - Recommended Follow-up
- Risk factors list
- Recommended actions
- Clinical interpretation

#### `MeasurementForm.jsx`
- Records:
  - IOP (OD/OS)
  - OCT RNFL thickness (OD/OS, optional)
  - VF Mean Deviation (OD/OS, optional)
  - Device type
  - Clinical notes

#### `TrendChart.jsx`
- SVG-based historical IOP visualization
- Shows OD (purple) and OS (cyan) lines
- Displays target IOP reference line
- Interactive data points with values

#### `TargetIOPDisplay.jsx`
- Visual gauge comparing current IOP vs target
- Color-coded status (green/yellow/red)
- Per-eye breakdown

### 5.3 Custom Hooks (`hooks/index.js`)

| Hook | Purpose |
|------|---------|
| `usePatients()` | Fetch patient list |
| `usePatient(id)` | Fetch single patient |
| `useLatestMeasurement(id)` | Get most recent IOP measurement |
| `useCurrentTarget(id)` | Get current target pressure |
| `useTrendData(id)` | Get historical measurements for chart |
| `useRiskSummary(id)` | Get risk assessment summary |
| `useApiHealth()` | Monitor backend connectivity |

---

## 6. Database Schema

### 6.1 Entity Relationship Diagram

```
┌──────────────┐       ┌───────────────────┐
│   patients   │───1:N─│  iop_measurements │
│──────────────│       │───────────────────│
│ id (PK)      │       │ id (PK)           │
│ patient_id   │       │ patient_id (FK)   │
│ name         │       │ measurement_date  │
│ dob          │       │ iop_od, iop_os    │
│ diagnosis    │       │ oct_rnfl_od/os    │
│ baseline_iop │       │ vf_md_od/os       │
│ glaucoma_    │       └───────────────────┘
│   stage_od/os│
└──────────────┘
        │
        │1:N
        ▼
┌──────────────────┐   ┌──────────────┐
│ target_pressures │   │    visits    │
│──────────────────│   │──────────────│
│ id (PK)          │   │ id (PK)      │
│ patient_id (FK)  │   │ patient_id   │
│ target_iop_od/os │   │ visit_date   │
│ trbs_score_od/os │   │ visit_type   │
│ risk_tier_od/os  │   │ findings     │
│ is_overridden_   │   │ treatment_   │
│   od/os          │   │   changes    │
│ trbs_data (JSON) │   └──────────────┘
└──────────────────┘
```

### 6.2 Key Columns

#### `target_pressures.trbs_data` (JSON)
Stores complete TRBS calculation details:
```json
{
  "od_result": {
    "eye": "OD",
    "trbs_score": 12,
    "risk_tier": "Moderate",
    "reduction_percentage_min": 30,
    "reduction_percentage_max": 35,
    "reduction_applied": 32,
    "glaucoma_stage": "ADVANCED",
    "upper_cap": 14,
    "baseline_iop": 22.0,
    "calculated_target": 14.96,
    "final_target": 14.0,
    "domain_scores": {
      "A_demographic": 2,
      "B_structural": 4,
      "C_functional": 2,
      "D_ocular": 1,
      "E_systemic": 2,
      "F_disease": 1
    }
  },
  "os_result": { ... }
}
```

---

## 7. Algorithms & Calculations

### 7.1 TRBS Scoring Domains

#### A. Demographic Risk (0-3 points)
| Factor | Scoring |
|--------|---------|
| Age <40 | 0 |
| Age 40-60 | 1 |
| Age 61-75 | 2 |
| Age >75 | 3 |
| African descent | +1 |
| Family history (1st degree) | +1 |

#### B. Structural Changes - Per Eye (0-7 points)
| Factor | Scoring |
|--------|---------|
| Cup-to-disc ratio 0.3-0.5 | 0 |
| Cup-to-disc ratio 0.6-0.7 | 2 |
| Cup-to-disc ratio 0.8-0.9 | 4 |
| Cup-to-disc ratio ≥0.9 | 5 |
| RNFL thinning (mild) | +1 |
| RNFL thinning (moderate) | +2 |

#### C. Functional/VF Changes - Per Eye (0-4 points)
| Factor | Scoring |
|--------|---------|
| MD > -6 dB (mild) | 1 |
| MD -6 to -12 dB (moderate) | 2 |
| MD < -12 dB (severe) | 4 |
| Documented progression | +1 |

#### D. Ocular Risk Modifiers - Per Eye (-1 to 4 points)
| Factor | Scoring |
|--------|---------|
| CCT <500 µm | +2 |
| CCT 500-555 µm | +1 |
| CCT >580 µm | -1 |
| High myopia (>-6D) | +1 |
| Pseudoexfoliation | +2 |
| Pigment dispersion | +1 |

#### E. Systemic Risk Factors (0-5 points)
| Factor | Scoring |
|--------|---------|
| Diabetes | +1 |
| Systemic hypertension | +1 |
| Cardiovascular disease | +1 |
| Sleep apnea | +1 |
| Migraine | +1 |

#### F. Disease/Patient Factors (0-3 points)
| Factor | Scoring |
|--------|---------|
| Rapid progression history | +2 |
| Monocular patient | +1 |
| Young age at diagnosis | +1 |

### 7.2 Target IOP Calculation Formula

```
1. Sum all domain scores → TRBS Score (0-25)

2. Map TRBS to reduction percentage:
   Score 0-6   → 22.5% reduction (midpoint of 20-25%)
   Score 7-12  → 32.5% reduction (midpoint of 30-35%)
   Score 13-18 → 42.5% reduction (midpoint of 40-45%)
   Score 19-25 → 50% reduction

3. Calculate preliminary target:
   preliminary_target = baseline_iop × (1 - reduction%)

4. Apply glaucoma stage upper cap:
   final_target = min(preliminary_target, stage_cap)

5. Round to 0.5 mmHg increments
```

### 7.3 Risk Score Calculation

```
Total Risk Score (0-100) = weighted sum of:
├── IOP Control (40%): severity × 1.3
├── RNFL Progression (25%): severity score
├── VF Progression (20%): severity score  
├── Disease Severity (10%): MILD=0, MODERATE=3, SEVERE=10
├── Pressure Fluctuation (5%): if >5 mmHg variation
└── Medication Adherence: +15 if POOR

Risk Level:
├── Score <30  → LOW
├── Score 30-69 → MODERATE
└── Score ≥70  → HIGH
```

---

## 8. API Endpoints Reference

### Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients/` | List all patients |
| GET | `/api/patients/{id}` | Get patient details |
| POST | `/api/patients/` | Create new patient |
| PUT | `/api/patients/{id}` | Update patient |
| DELETE | `/api/patients/{id}` | Delete patient |

### Measurements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/measurements/{patient_id}/` | List patient measurements |
| GET | `/api/measurements/{patient_id}/latest` | Get latest measurement |
| GET | `/api/measurements/{patient_id}/trend` | Get trend data for chart |
| GET | `/api/measurements/{patient_id}/validity-check` | Check 3-month validity |
| POST | `/api/measurements/{patient_id}/` | Record new measurement |

### Targets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/targets/{patient_id}/current` | Get current target |
| POST | `/api/targets/{patient_id}/calculate-trbs` | Calculate TRBS target |
| POST | `/api/targets/{patient_id}/save-with-override` | Save with manual override |

### Risk
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/risk/{patient_id}/assess` | Run full risk assessment |
| GET | `/api/risk/{patient_id}/summary` | Get risk summary |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |

---

## 9. Setup & Installation

### 9.1 Prerequisites
- Python 3.13+
- Node.js 18+
- MySQL 8.0+

### 9.2 Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv ../.venv

# Activate (Windows)
..\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Configure database (.env file)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=glaucoma_db

# Initialize database
python setup_database.py

# Seed sample data (optional)
python seed_data.py

# Start server
python run.py
# Server runs on http://localhost:8000
```

### 9.3 Frontend Setup

```bash
# From project root
npm install

# Start development server
npm run dev
# Server runs on http://localhost:5174
```

### 9.4 Quick Start Scripts

- `start-backend.bat` - Starts backend server
- `start-frontend.bat` - Starts frontend dev server

---

## 10. File Structure

```
E:\Hackathon\
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS config
│   │   ├── config.py            # Database configuration
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── schemas.py           # Pydantic models
│   │   ├── trbs_calculator.py   # TRBS algorithm (612 lines)
│   │   ├── risk_engine.py       # Risk stratification (269 lines)
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── patient.py
│   │   │   ├── iop_measurement.py
│   │   │   ├── target_pressure.py
│   │   │   └── visit.py
│   │   └── routes/              # API endpoints
│   │       ├── patients.py
│   │       ├── measurements.py
│   │       ├── targets.py
│   │       └── risk.py
│   ├── requirements.txt
│   ├── run.py                   # Server entry point
│   ├── setup_database.py        # DB initialization
│   └── seed_data.py             # Sample data generator
│
├── src/
│   ├── main.jsx                 # React entry point
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # Global styles
│   ├── components/
│   │   ├── Common.jsx           # Shared UI components
│   │   ├── PatientList.jsx      # Patient selection
│   │   ├── PatientDashboard.jsx # Main dashboard
│   │   ├── TargetIOPCalculator.jsx  # TRBS form
│   │   ├── TargetIOPDisplay.jsx # Target visualization
│   │   ├── RiskAssessmentPanel.jsx  # Risk display
│   │   ├── MeasurementForm.jsx  # IOP recording
│   │   ├── VisitForm.jsx        # Visit recording
│   │   └── TrendChart.jsx       # Historical chart
│   ├── hooks/
│   │   └── index.js             # Custom React hooks
│   ├── services/
│   │   └── api.js               # API client functions
│   └── styles/                  # Component CSS files
│       ├── Common.css
│       ├── PatientList.css
│       ├── PatientDashboard.css
│       ├── TargetIOP.css
│       ├── TargetIOPCalculator.css
│       ├── TargetIOPDisplay.css
│       ├── RiskAssessmentPanel.css
│       ├── MeasurementForm.css
│       ├── VisitForm.css
│       └── TrendChart.css
│
├── public/                      # Static assets
├── package.json                 # NPM dependencies
├── vite.config.js               # Vite configuration
├── eslint.config.js             # ESLint configuration
├── start-backend.bat            # Backend startup script
├── start-frontend.bat           # Frontend startup script
└── DOCUMENTATION.md             # This file
```

---

## Clinical Disclaimer

This software is intended as a **clinical decision support tool** only. The calculated target IOPs and risk assessments should always be reviewed and validated by qualified ophthalmologists. Final treatment decisions must account for factors not captured by this system, including:

- Patient preferences and quality of life
- Visual requirements for occupation/activities
- Treatment tolerability and adherence
- Co-morbidities and overall health status
- Clinical examination findings

**This software does not replace clinical judgment.**

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2026 | Initial release with per-eye TRBS calculation |

---

## License

© 2026 Glaucoma IOP Monitor. All rights reserved.
Developed for healthcare hackathon demonstration purposes.
