-- Migration script to add missing fields to glaucoma_risk_data table
-- Run this SQL script in your MySQL database

-- Add RNFL Defect fields
ALTER TABLE glaucoma_risk_data 
ADD COLUMN IF NOT EXISTS rnfl_defect_od VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rnfl_defect_os VARCHAR(20) DEFAULT NULL;

-- Add Myopia fields
ALTER TABLE glaucoma_risk_data 
ADD COLUMN IF NOT EXISTS myopia_od VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS myopia_os VARCHAR(20) DEFAULT NULL;

-- Verify columns were added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM information_schema.COLUMNS 
WHERE TABLE_NAME = 'glaucoma_risk_data' 
AND COLUMN_NAME IN ('rnfl_defect_od', 'rnfl_defect_os', 'myopia_od', 'myopia_os');

