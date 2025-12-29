# 👁️ Glaucoma IOP Monitoring System

## Automated Intra-Ocular Pressure Monitoring & Risk Stratification

A complete **full-stack healthcare application** for monitoring and managing intra-ocular pressure (IOP) in glaucoma patients with automated risk assessment and clinical decision support.

---

## ✨ Features

### 📊 Patient Management
- Track multiple glaucoma patients
- Store demographic and clinical data
- Search and filter patients
- View patient profiles

### 📈 IOP Tracking
- Record intra-ocular pressure readings (both eyes)
- Track measurement history
- Visualize trends with charts
- Compare against target pressures

### 🎯 Target Pressure Management
- Set individualized target pressures per patient
- Manage target pressure history
- Track pressure compliance

### 🧠 Automated Risk Assessment
- **5-factor weighted algorithm**
  - IOP Status (40%)
  - RNFL Progression (25%)
  - Visual Field Changes (20%)
  - Baseline Severity (10%)
  - IOP Fluctuation (5%)
- Risk stratification (LOW/MODERATE/HIGH)
- Automated follow-up recommendations
- Clinical decision support

### 📋 Clinical Visit Documentation
- Record clinical visits
- Document findings and treatment changes
- Track doctor notes
- Categorize visits (ROUTINE/URGENT/EMERGENCY)

### 📱 Responsive Design
- Works on desktop, tablet, mobile
- Professional UI/UX
- Intuitive navigation
- Real-time feedback

---

## 🚀 Quick Start (3 Steps)

### 1️⃣ Start Backend
```bash
cd e:\Hackathon
.venv\Scripts\python.exe backend\run.py
```
Wait for: `Uvicorn running on http://0.0.0.0:8000`

### 2️⃣ Start Frontend
```bash
cd e:\Hackathon
npm run dev
```
Wait for: `Local: http://localhost:5173`

### 3️⃣ Open Browser
Visit: **http://localhost:5173**

---

## 📚 Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **[QUICK_START.md](QUICK_START.md)** | 30-second setup guide | 2 min |
| **[INDEX.md](INDEX.md)** | Complete documentation index | 5 min |
| **[FRONTEND_SETUP.md](FRONTEND_SETUP.md)** | Detailed setup instructions | 20 min |
| **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** | Full developer documentation | 30 min |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture overview | 15 min |
| **[SYSTEM_STATUS.md](SYSTEM_STATUS.md)** | Current project status | 10 min |

### 👉 **New Users:** Start with [QUICK_START.md](QUICK_START.md)
### 👉 **Developers:** Read [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
### 👉 **Architecture:** See [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 🏗️ Technology Stack

### Frontend
- **React 19** - UI framework
- **JavaScript (ES6+)** - Programming language
- **CSS3** - Styling
- **Vite** - Build tool

### Backend
- **Python 3.13** - Programming language
- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **PyMySQL** - Database driver

### Database
- **MySQL 8.0+** - Relational database

---

## ✅ What's Included

### ✅ Complete Frontend
- 12 React components
- 8 custom hooks
- 40+ API functions
- 6 CSS files
- Responsive design

### ✅ Complete Backend
- 16 API endpoints
- Risk stratification engine
- Database with 4 tables
- Data validation
- Error handling

### ✅ Complete Documentation
- 8 markdown guides
- Architecture diagrams
- Code examples
- Troubleshooting guide

---

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| React Components | 12 |
| Custom Hooks | 8 |
| API Functions | 40+ |
| CSS Files | 6 |
| Database Tables | 4 |
| API Endpoints | 16 |
| Lines of Code | 7,500+ |
| Documentation | 8 guides |

---

## 🎯 Risk Stratification Algorithm

The system automatically calculates patient risk using a 5-factor weighted algorithm:

- **IOP Status** (40%)
- **RNFL Progression** (25%)
- **Visual Field Changes** (20%)
- **Baseline Severity** (10%)
- **IOP Fluctuation** (5%)

### Risk Levels
| Level | Score | Action |
|-------|-------|--------|
| 🟢 LOW | 0-29 | Routine 12-month follow-up |
| 🟡 MODERATE | 30-69 | Reassess in 3-6 months |
| 🔴 HIGH | 70-100 | Urgent intervention (2-4 weeks) |

---

## 📈 Project Status

### ✅ Phase 1: Backend - COMPLETE
- FastAPI application running
- MySQL database initialized
- All 16 API endpoints working
- Risk engine fully functional

### ✅ Phase 2: Frontend - COMPLETE
- React application built
- All 12 components working
- 8 custom hooks implemented
- Responsive CSS styling

### ✅ Phase 3: Integration - COMPLETE
- Frontend ↔ Backend communication working
- Data flows correctly
- Forms submit successfully

### ✅ Phase 4: Documentation - COMPLETE
- Setup guides provided
- Developer guide written
- Architecture documented

---

## 🚨 Troubleshooting

### "Cannot reach API"
Verify backend is running at http://localhost:8000/api/health

### "Port already in use"
```bash
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

See [FRONTEND_SETUP.md](FRONTEND_SETUP.md#-troubleshooting) for more help

---

## 🎓 Learning Resources

- **[QUICK_START.md](QUICK_START.md)** - 30-second setup
- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Complete developer reference
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture
- **[INDEX.md](INDEX.md)** - Documentation index

---

## 🎉 Ready to Start?

**See [QUICK_START.md](QUICK_START.md) for immediate setup instructions (2 minutes)**

---

**Status:** ✅ COMPLETE & OPERATIONAL  
**Backend:** Running on http://localhost:8000  
**Last Updated:** January 2024  

**Happy Monitoring! 👁️👁️**
