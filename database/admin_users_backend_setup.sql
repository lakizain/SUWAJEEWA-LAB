-- Admin Users Backend Setup
-- This script sets up the admin_users table and related backend functionality

-- =============================================
-- ADMIN USERS TABLE SETUP
-- =============================================

-- Create admin_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(10) NOT NULL CHECK (role IN ('admin','staff')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_users_created_at ON admin_users(created_at);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

-- Create function for automatic timestamp updates if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at column
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at 
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS) SETUP
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE admin_users TO anon, authenticated;
GRANT ALL ON SEQUENCE admin_users_id_seq TO anon, authenticated;

-- =============================================
-- SAMPLE DATA
-- =============================================

-- Insert sample admin users
INSERT INTO admin_users (username, email, password, role) VALUES 
('admin', 'admin@suwajeewa.com', 'admin123', 'admin'),
('staff1', 'staff1@suwajeewa.com', 'staff123', 'staff'),
('staff2', 'staff2@suwajeewa.com', 'staff123', 'staff'),
('manager', 'manager@suwajeewa.com', 'manager123', 'admin')
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- USEFUL FUNCTIONS
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

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- View for admin user management
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

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE admin_users IS 'Admin users table for laboratory management system';
COMMENT ON COLUMN admin_users.username IS 'Unique username for login';
COMMENT ON COLUMN admin_users.email IS 'Email address for notifications';
COMMENT ON COLUMN admin_users.password IS 'Plain text password (for development)';
COMMENT ON COLUMN admin_users.role IS 'User role: admin or staff';
COMMENT ON COLUMN admin_users.is_active IS 'Whether the user account is active';

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'admin_users' 
ORDER BY ordinal_position;

-- Verify sample data
SELECT 
    username,
    email,
    role,
    is_active,
    created_at
FROM admin_users
ORDER BY created_at;

-- Verify RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'admin_users';

-- =============================================
-- END OF SETUP
-- =============================================

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Admin users backend setup completed successfully!';
    RAISE NOTICE 'Table: admin_users created with RLS policies';
    RAISE NOTICE 'Sample data inserted: % admin users', (SELECT COUNT(*) FROM admin_users);
    RAISE NOTICE 'Functions and views created for admin user management';
END $$;
