-- =============================================
-- ADMIN USERS COMPLETE SCHEMA
-- =============================================
-- This file contains the complete schema for the admin_users table
-- Required for admin-users.html functionality
-- 
-- Table: admin_users
-- Purpose: Store admin panel user credentials and management data
-- Used by: admin-users.html, adminUsersService.js, adminUsersController.js
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- MAIN ADMIN USERS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS admin_users (
    -- Primary key with UUID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User credentials
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Plain text password (as per current implementation)
    
    -- User role and status
    role VARCHAR(10) NOT NULL CHECK (role IN ('admin','staff')),
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================

-- Index on username for login queries
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- Index on email for email-based queries
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Index on role for role-based filtering
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Index on is_active for active user queries
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- Index on created_at for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_admin_users_created_at ON admin_users(created_at);

-- Composite index for active users by role
CREATE INDEX IF NOT EXISTS idx_admin_users_active_role ON admin_users(is_active, role);

-- =============================================
-- TRIGGERS AND FUNCTIONS
-- =============================================

-- Function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger to automatically update updated_at column
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at 
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on admin_users table
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all for authenticated" ON admin_users;
DROP POLICY IF EXISTS "Allow all for anon" ON admin_users;

-- Create permissive policies for development
-- Note: In production, you should create more restrictive policies
CREATE POLICY "Allow all for authenticated" ON admin_users
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon" ON admin_users
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant necessary permissions to anon and authenticated users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE admin_users TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to get active admin users count
CREATE OR REPLACE FUNCTION get_active_admin_users_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM admin_users WHERE is_active = true);
END;
$$ LANGUAGE plpgsql;

-- Function to get admin users by role
CREATE OR REPLACE FUNCTION get_admin_users_by_role(user_role VARCHAR)
RETURNS TABLE (
    id UUID,
    username VARCHAR,
    email VARCHAR,
    role VARCHAR,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id,
        au.username,
        au.email,
        au.role,
        au.is_active,
        au.created_at
    FROM admin_users au
    WHERE au.role = user_role
    AND au.is_active = true
    ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to validate admin user credentials
CREATE OR REPLACE FUNCTION validate_admin_user_credentials(
    input_username VARCHAR,
    input_password VARCHAR
)
RETURNS TABLE (
    id UUID,
    username VARCHAR,
    email VARCHAR,
    role VARCHAR,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id,
        au.username,
        au.email,
        au.role,
        au.is_active
    FROM admin_users au
    WHERE au.username = input_username 
    AND au.password = input_password 
    AND au.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to check if username exists
CREATE OR REPLACE FUNCTION check_username_exists(input_username VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE username = input_username
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if email exists
CREATE OR REPLACE FUNCTION check_email_exists(input_email VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE email = input_email
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- View for admin user management (excludes password)
CREATE OR REPLACE VIEW admin_user_management AS
SELECT 
    id,
    username,
    email,
    role,
    is_active,
    created_at,
    updated_at,
    CASE 
        WHEN is_active THEN 'Active'
        ELSE 'Inactive'
    END as status_display
FROM admin_users
ORDER BY created_at DESC;

-- View for active admin users only
CREATE OR REPLACE VIEW active_admin_users AS
SELECT 
    id,
    username,
    email,
    role,
    created_at
FROM admin_users
WHERE is_active = true
ORDER BY created_at DESC;

-- View for admin users statistics
CREATE OR REPLACE VIEW admin_users_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
    COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
    COUNT(CASE WHEN role = 'admin' AND is_active = true THEN 1 END) as active_admins,
    COUNT(CASE WHEN role = 'staff' AND is_active = true THEN 1 END) as active_staff
FROM admin_users;

-- =============================================
-- SAMPLE DATA FOR TESTING
-- =============================================

-- Insert sample admin users for testing
INSERT INTO admin_users (username, email, password, role) VALUES 
('admin', 'admin@suwajeewa.com', 'admin123', 'admin'),
('staff1', 'staff1@suwajeewa.com', 'staff123', 'staff'),
('staff2', 'staff2@suwajeewa.com', 'staff123', 'staff'),
('manager', 'manager@suwajeewa.com', 'manager123', 'admin'),
('testuser', 'test@suwajeewa.com', 'test123', 'staff')
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- TABLE COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE admin_users IS 'Admin users table for laboratory management system - stores user credentials and roles for admin panel access';

COMMENT ON COLUMN admin_users.id IS 'Primary key - UUID automatically generated';
COMMENT ON COLUMN admin_users.username IS 'Unique username for login - must be unique across all admin users';
COMMENT ON COLUMN admin_users.email IS 'Email address for notifications and contact - must be unique';
COMMENT ON COLUMN admin_users.password IS 'Plain text password (for development) - should be hashed in production';
COMMENT ON COLUMN admin_users.role IS 'User role: admin (full access) or staff (limited access)';
COMMENT ON COLUMN admin_users.is_active IS 'Whether the user account is active - inactive users cannot login';
COMMENT ON COLUMN admin_users.created_at IS 'Timestamp when the user account was created';
COMMENT ON COLUMN admin_users.updated_at IS 'Timestamp when the user account was last updated - automatically updated by trigger';

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Query to verify table structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'admin_users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Query to verify sample data
SELECT 
    username,
    email,
    role,
    is_active,
    created_at
FROM admin_users
ORDER BY created_at;

-- Query to verify indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'admin_users'
ORDER BY indexname;

-- Query to verify RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'admin_users';

-- =============================================
-- USAGE EXAMPLES
-- =============================================

-- Example: Get all active admin users
-- SELECT * FROM admin_users WHERE is_active = true ORDER BY created_at DESC;

-- Example: Get users by role
-- SELECT * FROM get_admin_users_by_role('admin');

-- Example: Validate user credentials
-- SELECT * FROM validate_admin_user_credentials('admin', 'admin123');

-- Example: Check if username exists
-- SELECT check_username_exists('admin');

-- Example: Get user statistics
-- SELECT * FROM admin_users_stats;

-- Example: Create new user (as used by adminUsersService.js)
-- INSERT INTO admin_users (username, email, password, role) 
-- VALUES ('newuser', 'newuser@example.com', 'password123', 'staff');

-- Example: Update user role
-- UPDATE admin_users SET role = 'admin' WHERE username = 'staff1';

-- Example: Deactivate user (soft delete)
-- UPDATE admin_users SET is_active = false WHERE username = 'testuser';

-- Example: Permanently delete user
-- DELETE FROM admin_users WHERE username = 'testuser';

-- =============================================
-- INTEGRATION NOTES
-- =============================================

/*
This schema is designed to work with:

1. admin-users.html - Frontend interface for user management
   - Displays users in table format
   - Provides add/edit/delete functionality
   - Shows user roles with badges

2. adminUsersService.js - Service layer for API calls
   - getAllUsers() - SELECT * FROM admin_users ORDER BY created_at DESC
   - createUser() - INSERT INTO admin_users (username, email, password, role)
   - updateUser() - UPDATE admin_users SET ... WHERE id = ?
   - deleteUser() - UPDATE admin_users SET is_active = false WHERE id = ?
   - validateCredentials() - SELECT * FROM admin_users WHERE username = ? AND password = ?

3. adminUsersController.js - Controller for UI interactions
   - Handles form submissions
   - Manages dialog interactions
   - Updates UI based on service responses

4. Supabase Configuration
   - Uses Supabase client for database operations
   - RLS policies allow access for authenticated and anonymous users
   - All operations go through Supabase API

Security Notes:
- Passwords are stored as plain text (development only)
- In production, implement proper password hashing
- Consider implementing JWT tokens for session management
- Review and tighten RLS policies for production use
*/

-- =============================================
-- SUCCESS MESSAGE
-- =============================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'ADMIN USERS SCHEMA SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Table: admin_users created with all constraints';
    RAISE NOTICE 'Indexes: % indexes created for performance', (
        SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'admin_users'
    );
    RAISE NOTICE 'Sample data: % admin users inserted', (
        SELECT COUNT(*) FROM admin_users
    );
    RAISE NOTICE 'Functions: 5 utility functions created';
    RAISE NOTICE 'Views: 3 management views created';
    RAISE NOTICE 'RLS: Row Level Security policies enabled';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Ready for use with admin-users.html!';
    RAISE NOTICE '==============================================';
END $$;

-- =============================================
-- END OF ADMIN USERS COMPLETE SCHEMA
-- =============================================
