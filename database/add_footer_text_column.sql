-- Add footer_text column to tests table
-- This script adds the footer_text column to store footer text for each test

-- Add the footer_text column to the tests table
ALTER TABLE public.tests 
ADD COLUMN IF NOT EXISTS footer_text TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tests.footer_text IS 'Footer text to be displayed at the bottom of test reports';

-- Create index for footer_text searches (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_tests_footer_text ON public.tests USING gin(to_tsvector('english', footer_text)) TABLESPACE pg_default;

-- Update the existing trigger to handle footer_text updates
-- The existing update_updated_at_column() function will automatically handle the updated_at timestamp
                