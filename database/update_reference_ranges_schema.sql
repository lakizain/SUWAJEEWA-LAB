-- Update reference_ranges table to support text values with > and < symbols
-- This script modifies the min_value and max_value columns to accept text values

-- First, add new columns with TEXT type
ALTER TABLE reference_ranges 
ADD COLUMN min_value_text TEXT,
ADD COLUMN max_value_text TEXT;

-- Copy existing decimal values to text columns (convert to string)
UPDATE reference_ranges 
SET 
    min_value_text = CASE 
        WHEN min_value IS NOT NULL THEN min_value::TEXT 
        ELSE NULL 
    END,
    max_value_text = CASE 
        WHEN max_value IS NOT NULL THEN max_value::TEXT 
        ELSE NULL 
    END;

-- Drop the old decimal columns
ALTER TABLE reference_ranges 
DROP COLUMN min_value,
DROP COLUMN max_value;

-- Rename the new columns to the original names
ALTER TABLE reference_ranges 
RENAME COLUMN min_value_text TO min_value;

ALTER TABLE reference_ranges 
RENAME COLUMN max_value_text TO max_value;

-- Add comments to document the change
COMMENT ON COLUMN reference_ranges.min_value IS 'Minimum reference value - can be numeric (e.g., 5.0) or with operators (e.g., >5.0)';
COMMENT ON COLUMN reference_ranges.max_value IS 'Maximum reference value - can be numeric (e.g., 10.0) or with operators (e.g., <10.0)';
