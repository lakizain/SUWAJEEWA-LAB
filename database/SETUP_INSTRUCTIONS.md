# Database Setup Instructions

## Problem
The admin-users.html page shows the error: `relation "public.admin_users" does not exist`

## Solution
You need to create the database tables in your Supabase project.

## Step-by-Step Instructions

### Option 1: Complete Database Setup (Recommended)

1. **Open Supabase Dashboard**
   - Go to [supabase.com](https://supabase.com)
   - Sign in to your account
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Execute Complete Schema**
   - Open the file: `database/complete_schema.sql`
   - Copy ALL the contents (595 lines)
   - Paste into the Supabase SQL Editor
   - Click "Run" button

4. **Verify Setup**
   - Open the file: `database/check_admin_users_table.sql`
   - Copy the contents
   - Paste into a new query in Supabase SQL Editor
   - Click "Run"
   - You should see: "SUCCESS: admin_users table exists!"

### Option 2: Admin Users Only Setup

If you only want to set up the admin users table:

1. **Execute Admin Users Setup**
   - Open the file: `database/admin_users_backend_setup.sql`
   - Copy ALL the contents (246 lines)
   - Paste into the Supabase SQL Editor
   - Click "Run" button

2. **Verify Setup**
   - Run the check script as described in Option 1, Step 4

## Expected Results

After successful setup, you should have:

- ✅ `admin_users` table created
- ✅ Sample users: admin, staff1, staff2, manager
- ✅ Proper permissions and security policies
- ✅ Working admin-users.html page

## Default Login Credentials

After setup, you can use these test accounts:

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| staff1 | staff123 | staff |
| staff2 | staff123 | staff |
| manager | manager123 | admin |

## Troubleshooting

### If you get permission errors:
- Make sure you're signed in to Supabase as the project owner
- Check that your project is active and not paused

### If tables already exist:
- The scripts use `CREATE TABLE IF NOT EXISTS` so they're safe to run multiple times
- Use `ON CONFLICT DO NOTHING` for sample data insertion

### If you still get "table does not exist" errors:
1. Run the check script to verify table creation
2. Check the Supabase logs for any error messages
3. Ensure you're connecting to the correct database

## Next Steps

Once the database is set up:
1. Refresh your admin-users.html page
2. The page should load without errors
3. You should see the sample users in the table
4. You can add, edit, and delete users through the interface
