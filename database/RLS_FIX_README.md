# RLS Policy Fix for Test Results

## Problem
You're getting `401 (Unauthorized)` errors when trying to save test results because the `test_results` and `test_report_headers` tables have Row Level Security (RLS) enabled but don't have policies that allow anonymous access.

## Solution
Run the SQL script `fix_test_results_rls.sql` in your Supabase SQL Editor.

## Steps to Fix

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Fix Script**
   - Open the file `database/fix_test_results_rls.sql`
   - Copy all the SQL code
   - Paste it into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify the Fix**
   - The script will show you a list of created policies
   - You should see policies for `test_results` and `test_report_headers` tables
   - Both should have policies for `authenticated` and `anon` roles

5. **Test the Application**
   - Go back to your application
   - Try saving test results again
   - The 401 errors should be gone

## What the Script Does

The script:
- Enables RLS on the required tables (if not already enabled)
- Creates policies that allow both `authenticated` and `anon` users to:
  - SELECT (read) data
  - INSERT (create) data
  - UPDATE (modify) data
  - DELETE (remove) data

## Important Note

This configuration allows anonymous access for development purposes. For production, you should:
- Restrict anonymous access
- Use proper authentication
- Implement more granular permissions based on user roles

