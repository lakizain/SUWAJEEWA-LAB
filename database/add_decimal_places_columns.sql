-- Add decimal_places columns to tests and test_subcategories tables
-- Default decimal places is 2 for both columns

DO $$
BEGIN
    -- Add column to tests table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tests' 
        AND column_name = 'decimal_places'
    ) THEN
        ALTER TABLE tests ADD COLUMN decimal_places INTEGER DEFAULT 2;
    END IF;

    -- Add column to test_subcategories table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_subcategories' 
        AND column_name = 'decimal_places'
    ) THEN
        ALTER TABLE test_subcategories ADD COLUMN decimal_places INTEGER DEFAULT 2;
    END IF;
END $$;