"""
Application initialization and route registration
"""
from app.routes import patients, measurements, targets, risk, emr

def include_routes(app):
    """Register all API routes"""
    app.include_router(patients.router)
    app.include_router(measurements.router)
    app.include_router(targets.router)
    app.include_router(risk.router)
    app.include_router(emr.router)
