-- Database Update Script for Tests Table
-- Adding Test Duration and Test Cost fields
-- Run this script to update the existing tests table

-- Add new columns to the tests table
ALTER TABLE tests 
ADD COLUMN IF NOT EXISTS duration INTEGER,
ADD COLUMN IF NOT EXISTS test_cost DECIMAL(10,2);

-- Add comments to the new columns for documentation
COMMENT ON COLUMN tests.duration IS 'Test duration in minutes';
COMMENT ON COLUMN tests.test_cost IS 'Internal cost of performing the test';

-- Update existing sample data with default values for the new fields
UPDATE tests 
SET 
    duration = CASE 
        WHEN test_name = 'Complete Blood Count' THEN 30
        WHEN test_name = 'Blood Glucose' THEN 15
        WHEN test_name = 'Urine Analysis' THEN 20
        WHEN test_name = 'Liver Function Test' THEN 45
        WHEN test_name = 'Kidney Function Test' THEN 40
        ELSE 30
    END,
    test_cost = CASE 
        WHEN test_name = 'Complete Blood Count' THEN 200.00
        WHEN test_name = 'Blood Glucose' THEN 100.00
        WHEN test_name = 'Urine Analysis' THEN 150.00
        WHEN test_name = 'Liver Function Test' THEN 300.00
        WHEN test_name = 'Kidney Function Test' THEN 280.00
        ELSE 200.00
    END
WHERE duration IS NULL OR test_cost IS NULL;

-- Add constraints to ensure data integrity
ALTER TABLE tests 
ADD CONSTRAINT check_duration_positive CHECK (duration > 0),
ADD CONSTRAINT check_test_cost_non_negative CHECK (test_cost >= 0);

-- Create indexes for better performance on the new fields
CREATE INDEX IF NOT EXISTS idx_tests_duration ON tests(duration);
CREATE INDEX IF NOT EXISTS idx_tests_test_cost ON tests(test_cost);

-- Update the main setup.sql file to include these fields in future installations
-- This is a reference for updating the main setup.sql file

/*
-- Updated tests table structure for setup.sql:
CREATE TABLE IF NOT EXISTS tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration INTEGER,
    test_cost DECIMAL(10,2),
    remarks TEXT,
    specimen VARCHAR(100),
    tube VARCHAR(50),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_duration_positive CHECK (duration > 0),
    CONSTRAINT check_test_cost_non_negative CHECK (test_cost >= 0)
);

-- Updated sample data for setup.sql:
INSERT INTO tests (test_name, short_name, price, duration, test_cost, category, specimen, tube) VALUES 
('Complete Blood Count', 'CBC', 1500.00, 30, 200.00, 'Hematology', 'Blood', 'Purple Top'),
('Blood Glucose', 'BG', 800.00, 15, 100.00, 'Biochemistry', 'Blood', 'Red Top'),
('Urine Analysis', 'UA', 600.00, 20, 150.00, 'Microbiology', 'Urine', 'Sterile Container'),
('Liver Function Test', 'LFT', 2000.00, 45, 300.00, 'Biochemistry', 'Blood', 'Red Top'),
('Kidney Function Test', 'KFT', 1800.00, 40, 280.00, 'Biochemistry', 'Blood', 'Red Top')
ON CONFLICT DO NOTHING;
*/

-- Verify the changes
SELECT 
    test_name,
    short_name,
    price,
    duration,
    test_cost,
    category,
    is_active
FROM tests 
ORDER BY test_name;
