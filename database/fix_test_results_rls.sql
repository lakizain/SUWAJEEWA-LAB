-- Fix RLS policies for test_results and test_report_headers tables
-- This script adds missing RLS policies to allow access for development
-- Run this in your Supabase SQL Editor

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS test_report_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS test_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subcategory_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reference_ranges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DO $$ 
BEGIN
    -- test_results policies
    DROP POLICY IF EXISTS "Allow all for authenticated" ON test_results;
    DROP POLICY IF EXISTS "Allow all for anon" ON test_results;
    
    -- test_report_headers policies
    DROP POLICY IF EXISTS "Allow all for authenticated" ON test_report_headers;
    DROP POLICY IF EXISTS "Allow all for anon" ON test_report_headers;
    
    -- test_subcategories policies
    DROP POLICY IF EXISTS "Allow all for authenticated" ON test_subcategories;
    DROP POLICY IF EXISTS "Allow all for anon" ON test_subcategories;
    
    -- subcategory_suggestions policies
    DROP POLICY IF EXISTS "Allow all for authenticated" ON subcategory_suggestions;
    DROP POLICY IF EXISTS "Allow all for anon" ON subcategory_suggestions;
    
    -- reference_ranges policies
    DROP POLICY IF EXISTS "Allow all for authenticated" ON reference_ranges;
    DROP POLICY IF EXISTS "Allow all for anon" ON reference_ranges;
END $$;

-- Create policies for test_results table
-- Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON test_results
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow all operations for anonymous users (for development)
-- NOTE: For production, you may want to restrict this
CREATE POLICY "Allow all for anon" ON test_results
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create policies for test_report_headers table
-- Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON test_report_headers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow all operations for anonymous users (for development)
-- NOTE: For production, you may want to restrict this
CREATE POLICY "Allow all for anon" ON test_report_headers
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Policies for test_subcategories
CREATE POLICY "Allow all for authenticated" ON test_subcategories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON test_subcategories
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Policies for subcategory_suggestions
CREATE POLICY "Allow all for authenticated" ON subcategory_suggestions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON subcategory_suggestions
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Policies for reference_ranges
CREATE POLICY "Allow all for authenticated" ON reference_ranges
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON reference_ranges
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('test_results', 'test_report_headers', 'test_subcategories', 'subcategory_suggestions', 'reference_ranges')
ORDER BY tablename, policyname;

