-- Quick check to see if admin_users table exists
-- Run this in Supabase SQL Editor to verify table setup

-- Step 1: Check if table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'admin_users' 
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'SUCCESS: admin_users table exists!';
        
        -- Show table structure
        RAISE NOTICE 'Table structure:';
        
        -- Show sample data count
        RAISE NOTICE 'Total records: %', (SELECT COUNT(*) FROM admin_users);
        
    ELSE
        RAISE NOTICE 'ERROR: admin_users table does NOT exist!';
        RAISE NOTICE 'You need to run the complete_schema.sql or admin_users_backend_setup.sql first';
    END IF;
END $$;

-- Step 2: If table exists, show its structure (safe version)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'admin_users' 
AND table_schema = 'public'
ORDER BY ordinal_position;
