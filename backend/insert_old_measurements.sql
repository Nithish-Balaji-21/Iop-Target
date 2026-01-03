-- Insert old IOP measurements (older than 90 days) for testing the 90-day alert popup
-- Run this in your MySQL database

-- First, check existing patients
SELECT id, patient_id, name FROM patients LIMIT 5;

-- Insert old measurements for patient_id = 1 (change this to your actual patient ID)
-- Measurement from 95 days ago (just over 90 days - will trigger alert)
INSERT INTO iop_measurements (
    patient_id,
    iop_od,
    iop_os,
    measurement_date,
    measured_by,
    device_type,
    clinical_notes,
    created_at,
    updated_at
) VALUES (
    1,  -- Change this to your patient ID
    22.0,
    23.0,
    DATE_SUB(NOW(), INTERVAL 95 DAY),
    'Test System',
    'Goldmann Tonometry',
    'Test measurement - 95 days ago (should trigger 90-day alert)',
    NOW(),
    NOW()
);

-- Measurement from 120 days ago (4 months old)
INSERT INTO iop_measurements (
    patient_id,
    iop_od,
    iop_os,
    measurement_date,
    measured_by,
    device_type,
    clinical_notes,
    created_at,
    updated_at
) VALUES (
    1,  -- Change this to your patient ID
    21.5,
    22.5,
    DATE_SUB(NOW(), INTERVAL 120 DAY),
    'Test System',
    'Goldmann Tonometry',
    'Test measurement - 120 days ago (very old)',
    NOW(),
    NOW()
);

-- Measurement from 180 days ago (6 months old)
INSERT INTO iop_measurements (
    patient_id,
    iop_od,
    iop_os,
    measurement_date,
    measured_by,
    device_type,
    clinical_notes,
    created_at,
    updated_at
) VALUES (
    1,  -- Change this to your patient ID
    20.0,
    21.0,
    DATE_SUB(NOW(), INTERVAL 180 DAY),
    'Test System',
    'Goldmann Tonometry',
    'Test measurement - 180 days ago (extremely old)',
    NOW(),
    NOW()
);

-- Verify the measurements were created
SELECT 
    id,
    patient_id,
    iop_od,
    iop_os,
    measurement_date,
    DATEDIFF(NOW(), measurement_date) AS days_ago,
    measured_by,
    clinical_notes
FROM iop_measurements
WHERE patient_id = 1  -- Change this to your patient ID
ORDER BY measurement_date DESC;

