-- SUWAJEEWA LABORATORIES - COMPLETE DATABASE SCHEMA
-- This file contains the complete database schema for the laboratory management system
-- Run this script to set up the entire database from scratch

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CORE USER MANAGEMENT TABLES
-- =============================================

-- Main users table (Supabase Auth integration)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'manager')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin users table (for admin panel management)
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
-- CENTER MANAGEMENT TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cid VARCHAR(10) UNIQUE NOT NULL,
    center_name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- REFERENCE MANAGEMENT TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rid VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    commission DECIMAL(5,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TEST MANAGEMENT TABLES
-- =============================================

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

CREATE TABLE IF NOT EXISTS test_subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    subcategory_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subcategory_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory_id UUID REFERENCES test_subcategories(id) ON DELETE CASCADE,
    suggestion_text TEXT NOT NULL,
    suggestion_type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reference_ranges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    subcategory_id UUID REFERENCES test_subcategories(id) ON DELETE CASCADE,
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Both')),
    age_min INTEGER,
    age_max INTEGER,
    min_value DECIMAL(10,2),
    max_value DECIMAL(10,2),
    unit VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PACKAGE MANAGEMENT TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pgid VARCHAR(10) UNIQUE NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS package_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(package_id, test_id)
);

CREATE TABLE IF NOT EXISTS center_test_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(center_id, test_id)
);

CREATE TABLE IF NOT EXISTS center_package_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(center_id, package_id)
);

-- =============================================
-- BILLING MANAGEMENT TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_no VARCHAR(20) UNIQUE NOT NULL,
    bill_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    bill_type VARCHAR(50) DEFAULT 'Main Lab',
    center_id UUID REFERENCES centers(id),
    patient_phone VARCHAR(20),
    patient_name VARCHAR(255) NOT NULL,
    patient_title VARCHAR(10),
    patient_age_years INTEGER,
    patient_age_months INTEGER,
    patient_age_days INTEGER,
    patient_gender VARCHAR(10) CHECK (patient_gender IN ('Male', 'Female', 'Other')),
    ref_by VARCHAR(255),
    new_referral VARCHAR(255),
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    discount DECIMAL(10,2) DEFAULT 0.00,
    final_amount DECIMAL(10,2) DEFAULT 0.00,
    paid_amount DECIMAL(10,2) DEFAULT 0.00,
    remaining_amount DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id),
    package_id UUID REFERENCES packages(id),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    is_package_component BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TEST RESULTS AND REPORTING TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    subcategory_id UUID REFERENCES test_subcategories(id) ON DELETE SET NULL,
    value TEXT,
    unit VARCHAR(50),
    status VARCHAR(20),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_report_headers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    bill_item_id UUID NOT NULL REFERENCES bill_items(id) ON DELETE CASCADE,
    comments_result TEXT,
    special_notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    verified_by VARCHAR(120),
    created_by VARCHAR(120),
    updated_by VARCHAR(120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (bill_item_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Admin users indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- Centers indexes
CREATE INDEX IF NOT EXISTS idx_centers_cid ON centers(cid);
CREATE INDEX IF NOT EXISTS idx_centers_name ON centers(center_name);
CREATE INDEX IF NOT EXISTS idx_centers_active ON centers(is_active);

-- References indexes
CREATE INDEX IF NOT EXISTS idx_references_rid ON references(rid);
CREATE INDEX IF NOT EXISTS idx_references_name ON references(name);
CREATE INDEX IF NOT EXISTS idx_references_active ON references(is_active);

-- Tests indexes
CREATE INDEX IF NOT EXISTS idx_tests_name ON tests(test_name);
CREATE INDEX IF NOT EXISTS idx_tests_short_name ON tests(short_name);
CREATE INDEX IF NOT EXISTS idx_tests_category ON tests(category);
CREATE INDEX IF NOT EXISTS idx_tests_active ON tests(is_active);
CREATE INDEX IF NOT EXISTS idx_tests_duration ON tests(duration);
CREATE INDEX IF NOT EXISTS idx_tests_test_cost ON tests(test_cost);

-- Packages indexes
CREATE INDEX IF NOT EXISTS idx_packages_pgid ON packages(pgid);
CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(package_name);
CREATE INDEX IF NOT EXISTS idx_packages_active ON packages(is_active);

-- Bills indexes
CREATE INDEX IF NOT EXISTS idx_bills_bill_no ON bills(bill_no);
CREATE INDEX IF NOT EXISTS idx_bills_patient_phone ON bills(patient_phone);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
CREATE INDEX IF NOT EXISTS idx_bills_center_id ON bills(center_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

-- Bill items indexes
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_test_id ON bill_items(test_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_package_id ON bill_items(package_id);

-- Package tests indexes
CREATE INDEX IF NOT EXISTS idx_package_tests_package_id ON package_tests(package_id);
CREATE INDEX IF NOT EXISTS idx_package_tests_test_id ON package_tests(test_id);
CREATE INDEX IF NOT EXISTS idx_center_test_prices_center_id ON center_test_prices(center_id);
CREATE INDEX IF NOT EXISTS idx_center_test_prices_test_id ON center_test_prices(test_id);
CREATE INDEX IF NOT EXISTS idx_center_test_prices_center_test ON center_test_prices(center_id, test_id);
CREATE INDEX IF NOT EXISTS idx_center_package_prices_center_id ON center_package_prices(center_id);
CREATE INDEX IF NOT EXISTS idx_center_package_prices_package_id ON center_package_prices(package_id);
CREATE INDEX IF NOT EXISTS idx_center_package_prices_center_package ON center_package_prices(center_id, package_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_package_component ON bill_items(package_id, is_package_component);

-- Test subcategories indexes
CREATE INDEX IF NOT EXISTS idx_test_subcategories_test_id ON test_subcategories(test_id);
CREATE INDEX IF NOT EXISTS idx_subcategory_suggestions_subcategory_id ON subcategory_suggestions(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_reference_ranges_test_id ON reference_ranges(test_id);
CREATE INDEX IF NOT EXISTS idx_reference_ranges_subcategory_id ON reference_ranges(subcategory_id);

-- Test results indexes
CREATE INDEX IF NOT EXISTS idx_test_results_bill_id ON test_results(bill_id);
CREATE INDEX IF NOT EXISTS idx_test_results_subcategory_id ON test_results(subcategory_id);

-- Test report headers indexes
CREATE INDEX IF NOT EXISTS idx_trh_bill_id ON test_report_headers(bill_id);
CREATE INDEX IF NOT EXISTS idx_trh_bill_item_id ON test_report_headers(bill_item_id);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_centers_updated_at BEFORE UPDATE ON centers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_references_updated_at BEFORE UPDATE ON references
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_center_test_prices_updated_at BEFORE UPDATE ON center_test_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_center_package_prices_updated_at BEFORE UPDATE ON center_package_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_report_headers_updated_at BEFORE UPDATE ON test_report_headers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate bill totals
CREATE OR REPLACE FUNCTION calculate_bill_total(bill_uuid UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    total DECIMAL(10,2) := 0;
BEGIN
    SELECT COALESCE(SUM(total_price), 0) INTO total
    FROM bill_items
    WHERE bill_id = bill_uuid;
    
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Function to update bill totals
CREATE OR REPLACE FUNCTION update_bill_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE bills 
    SET 
        total_amount = calculate_bill_total(NEW.bill_id),
        updated_at = NOW()
    WHERE id = NEW.bill_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update bill totals when items change
CREATE TRIGGER update_bill_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bill_items
    FOR EACH ROW EXECUTE FUNCTION update_bill_totals();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE references ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_report_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategory_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_test_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_package_prices ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development (adjust for production)
DO $$ BEGIN
    -- Users table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON users
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Admin users table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_users' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON admin_users
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Centers table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='centers' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON centers
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- References table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='references' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON references
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Tests table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tests' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON tests
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Packages table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='packages' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON packages
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Bills table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bills' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON bills
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Bill items table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bill_items' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON bill_items
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Test results table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_results' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON test_results
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Test report headers table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_report_headers' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON test_report_headers
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Test subcategories table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_subcategories' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON test_subcategories
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Subcategory suggestions table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subcategory_suggestions' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON subcategory_suggestions
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Reference ranges table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reference_ranges' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON reference_ranges
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Package tests table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='package_tests' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON package_tests
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Center test prices table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='center_test_prices' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON center_test_prices
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Center package prices table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='center_package_prices' AND policyname='Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON center_package_prices
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- Bill summary view
CREATE OR REPLACE VIEW bill_summary AS
SELECT 
    b.id,
    b.bill_no,
    b.bill_date,
    b.patient_name,
    b.patient_phone,
    b.total_amount,
    b.discount,
    b.final_amount,
    b.paid_amount,
    b.remaining_amount,
    b.status,
    c.center_name,
    COUNT(bi.id) as item_count
FROM bills b
LEFT JOIN centers c ON b.center_id = c.id
LEFT JOIN bill_items bi ON b.id = bi.bill_id
GROUP BY b.id, b.bill_no, b.bill_date, b.patient_name, b.patient_phone, 
         b.total_amount, b.discount, b.final_amount, b.paid_amount, 
         b.remaining_amount, b.status, c.center_name;

-- Package details view
CREATE OR REPLACE VIEW package_details AS
SELECT 
    p.id,
    p.pgid,
    p.package_name,
    p.price,
    p.is_active,
    COUNT(pt.test_id) as test_count,
    STRING_AGG(t.test_name, ', ') as test_names
FROM packages p
LEFT JOIN package_tests pt ON p.id = pt.package_id
LEFT JOIN tests t ON pt.test_id = t.id
GROUP BY p.id, p.pgid, p.package_name, p.price, p.is_active;

CREATE OR REPLACE FUNCTION get_test_price_for_center(p_center_id UUID, p_test_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_center_price DECIMAL(10,2);
    v_global_price DECIMAL(10,2);
BEGIN
    SELECT ctp.price
      INTO v_center_price
      FROM center_test_prices ctp
     WHERE ctp.center_id = p_center_id
       AND ctp.test_id = p_test_id
       AND ctp.is_active = true
     LIMIT 1;

    IF v_center_price IS NOT NULL THEN
        RETURN v_center_price;
    END IF;

    SELECT t.price
      INTO v_global_price
      FROM tests t
     WHERE t.id = p_test_id
     LIMIT 1;

    RETURN COALESCE(v_global_price, 0);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_package_price_for_center(p_center_id UUID, p_package_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_center_price DECIMAL(10,2);
    v_global_price DECIMAL(10,2);
BEGIN
    SELECT cpp.price
      INTO v_center_price
      FROM center_package_prices cpp
     WHERE cpp.center_id = p_center_id
       AND cpp.package_id = p_package_id
       AND cpp.is_active = true
     LIMIT 1;

    IF v_center_price IS NOT NULL THEN
        RETURN v_center_price;
    END IF;

    SELECT p.price
      INTO v_global_price
      FROM packages p
     WHERE p.id = p_package_id
     LIMIT 1;

    RETURN COALESCE(v_global_price, 0);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE VIEW test_pricing_view AS
SELECT
    t.id AS test_id,
    t.test_name,
    t.short_name,
    t.price AS global_price,
    c.id AS center_id,
    c.center_name,
    c.cid,
    ctp.price AS center_price,
    COALESCE(ctp.price, t.price) AS resolved_price,
    (ctp.price IS NOT NULL) AS has_center_price
FROM tests t
CROSS JOIN centers c
LEFT JOIN center_test_prices ctp
       ON ctp.center_id = c.id
      AND ctp.test_id = t.id
      AND ctp.is_active = true
WHERE t.is_active = true
  AND c.is_active = true;

CREATE OR REPLACE VIEW package_pricing_view AS
SELECT
    p.id AS package_id,
    p.package_name,
    p.pgid,
    p.price AS global_price,
    c.id AS center_id,
    c.center_name,
    c.cid,
    cpp.price AS center_price,
    COALESCE(cpp.price, p.price) AS resolved_price,
    (cpp.price IS NOT NULL) AS has_center_price
FROM packages p
CROSS JOIN centers c
LEFT JOIN center_package_prices cpp
       ON cpp.center_id = c.id
      AND cpp.package_id = p.id
      AND cpp.is_active = true
WHERE p.is_active = true
  AND c.is_active = true;

-- User management view
CREATE OR REPLACE VIEW user_management AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    u.is_active,
    u.created_at,
    u.updated_at
FROM users u
UNION ALL
SELECT 
    au.id,
    au.username,
    au.email,
    au.role,
    au.is_active,
    au.created_at,
    au.updated_at
FROM admin_users au;

-- =============================================
-- SAMPLE DATA
-- =============================================

-- Insert sample centers
INSERT INTO centers (cid, center_name, address, phone) VALUES 
('CID001', 'KURUNEGALA CENTER', '123 Main Street, Kurunegala', '037-1234567'),
('CID002', 'COLOMBO CENTER', '456 Galle Road, Colombo', '011-2345678'),
('CID003', 'KANDY CENTER', '789 Peradeniya Road, Kandy', '081-3456789')
ON CONFLICT (cid) DO NOTHING;

-- Insert sample references
INSERT INTO references (rid, name, phone, commission) VALUES 
('RID001', 'DR M AMUNUGAMA', '077-1234567', 5.00),
('RID002', 'DR S PERERA', '077-2345678', 3.50),
('RID003', 'DR J SILVA', '077-3456789', 4.00)
ON CONFLICT (rid) DO NOTHING;

-- Insert sample tests
INSERT INTO tests (test_name, short_name, price, duration, test_cost, category, specimen, tube) VALUES 
('Complete Blood Count', 'CBC', 1500.00, 30, 200.00, 'Hematology', 'Blood', 'Purple Top'),
('Blood Glucose', 'BG', 800.00, 15, 100.00, 'Biochemistry', 'Blood', 'Red Top'),
('Urine Analysis', 'UA', 600.00, 20, 150.00, 'Microbiology', 'Urine', 'Sterile Container'),
('Liver Function Test', 'LFT', 2000.00, 45, 300.00, 'Biochemistry', 'Blood', 'Red Top'),
('Kidney Function Test', 'KFT', 1800.00, 40, 280.00, 'Biochemistry', 'Blood', 'Red Top')
ON CONFLICT DO NOTHING;

-- Insert sample packages
INSERT INTO packages (pgid, package_name, price, description) VALUES 
('PGID001', 'FULL BODY CHECK-UP', 2700.00, 'Comprehensive health checkup package'),
('PGID002', 'MEDICAL CHECK UP NALANDA', 2100.00, 'Special medical checkup for Nalanda patients'),
('PGID003', 'PHI PACK', 2000.00, 'Basic health screening package'),
('PGID004', 'TEST PACK', 3000.00, 'Advanced diagnostic package')
ON CONFLICT (pgid) DO NOTHING;

-- Insert sample admin users
INSERT INTO admin_users (username, email, password, role) VALUES 
('admin', 'admin@suwajeewa.com', 'admin123', 'admin'),
('staff1', 'staff1@suwajeewa.com', 'staff123', 'staff'),
('staff2', 'staff2@suwajeewa.com', 'staff123', 'staff')
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON DATABASE current_database() IS 'SUWAJEEWA LABORATORIES MANAGEMENT SYSTEM DATABASE';

COMMENT ON TABLE users IS 'Main users table integrated with Supabase Auth';
COMMENT ON TABLE admin_users IS 'Admin panel users for system management';
COMMENT ON TABLE centers IS 'Laboratory centers/branches';
COMMENT ON TABLE references IS 'Medical references/doctors';
COMMENT ON TABLE tests IS 'Laboratory tests and procedures';
COMMENT ON TABLE packages IS 'Test packages and bundles';
COMMENT ON TABLE bills IS 'Patient bills and invoices';
COMMENT ON TABLE bill_items IS 'Individual items in bills';
COMMENT ON TABLE test_results IS 'Test results and values';
COMMENT ON TABLE test_report_headers IS 'Test report headers and comments';

-- =============================================
-- END OF SCHEMA
-- =============================================
