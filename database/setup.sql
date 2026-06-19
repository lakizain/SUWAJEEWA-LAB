-- SUWAJEEWA LABORATORIES DATABASE SETUP
-- This script creates all necessary tables for the laboratory management system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'manager')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create centers table
CREATE TABLE IF NOT EXISTS centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cid VARCHAR(10) UNIQUE NOT NULL,
    center_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create references table
CREATE TABLE IF NOT EXISTS references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rid VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    commission DECIMAL(5,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tests table
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

-- Create test_subcategories table
CREATE TABLE IF NOT EXISTS test_subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    subcategory_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subcategory_suggestions table
CREATE TABLE IF NOT EXISTS subcategory_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory_id UUID REFERENCES test_subcategories(id) ON DELETE CASCADE,
    suggestion_text TEXT NOT NULL,
    suggestion_type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reference_ranges table
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

-- Create packages table
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pgid VARCHAR(10) UNIQUE NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create package_tests table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS package_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(package_id, test_id)
);

-- Create bills table
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

-- Create bill_items table
CREATE TABLE IF NOT EXISTS bill_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id),
    package_id UUID REFERENCES packages(id),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bills_bill_no ON bills(bill_no);
CREATE INDEX IF NOT EXISTS idx_bills_patient_phone ON bills(patient_phone);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
CREATE INDEX IF NOT EXISTS idx_bills_center_id ON bills(center_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

CREATE INDEX IF NOT EXISTS idx_tests_name ON tests(test_name);
CREATE INDEX IF NOT EXISTS idx_tests_short_name ON tests(short_name);
CREATE INDEX IF NOT EXISTS idx_tests_category ON tests(category);
CREATE INDEX IF NOT EXISTS idx_tests_active ON tests(is_active);
CREATE INDEX IF NOT EXISTS idx_tests_duration ON tests(duration);
CREATE INDEX IF NOT EXISTS idx_tests_test_cost ON tests(test_cost);

CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(package_name);
CREATE INDEX IF NOT EXISTS idx_packages_pgid ON packages(pgid);
CREATE INDEX IF NOT EXISTS idx_packages_active ON packages(is_active);

CREATE INDEX IF NOT EXISTS idx_references_name ON references(name);
CREATE INDEX IF NOT EXISTS idx_references_rid ON references(rid);
CREATE INDEX IF NOT EXISTS idx_references_active ON references(is_active);

CREATE INDEX IF NOT EXISTS idx_centers_name ON centers(center_name);
CREATE INDEX IF NOT EXISTS idx_centers_cid ON centers(cid);
CREATE INDEX IF NOT EXISTS idx_centers_active ON centers(is_active);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_test_id ON bill_items(test_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_package_id ON bill_items(package_id);

CREATE INDEX IF NOT EXISTS idx_package_tests_package_id ON package_tests(package_id);
CREATE INDEX IF NOT EXISTS idx_package_tests_test_id ON package_tests(test_id);

CREATE INDEX IF NOT EXISTS idx_test_subcategories_test_id ON test_subcategories(test_id);
CREATE INDEX IF NOT EXISTS idx_subcategory_suggestions_subcategory_id ON subcategory_suggestions(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_reference_ranges_test_id ON reference_ranges(test_id);
CREATE INDEX IF NOT EXISTS idx_reference_ranges_subcategory_id ON reference_ranges(subcategory_id);

-- Test results per subcategory per bill
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

CREATE INDEX IF NOT EXISTS idx_test_results_bill_id ON test_results(bill_id);
CREATE INDEX IF NOT EXISTS idx_test_results_subcategory_id ON test_results(subcategory_id);

-- Test report header per bill item (overall comments and special notes)
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

CREATE INDEX IF NOT EXISTS idx_trh_bill_id ON test_report_headers(bill_id);
CREATE INDEX IF NOT EXISTS idx_trh_bill_item_id ON test_report_headers(bill_item_id);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_centers_updated_at BEFORE UPDATE ON centers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_references_updated_at BEFORE UPDATE ON references
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO centers (cid, center_name) VALUES 
('CID001', 'KURUNEGALA CENTER'),
('CID002', 'COLOMBO CENTER'),
('CID003', 'KANDY CENTER')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO references (rid, name, commission) VALUES 
('RID001', 'DR M AMUNUGAMA', 5.00),
('RID002', 'DR S PERERA', 3.50),
('RID003', 'DR J SILVA', 4.00)
ON CONFLICT (rid) DO NOTHING;

INSERT INTO tests (test_name, short_name, price, duration, test_cost, category, specimen, tube) VALUES 
('Complete Blood Count', 'CBC', 1500.00, 30, 200.00, 'Hematology', 'Blood', 'Purple Top'),
('Blood Glucose', 'BG', 800.00, 15, 100.00, 'Biochemistry', 'Blood', 'Red Top'),
('Urine Analysis', 'UA', 600.00, 20, 150.00, 'Microbiology', 'Urine', 'Sterile Container'),
('Liver Function Test', 'LFT', 2000.00, 45, 300.00, 'Biochemistry', 'Blood', 'Red Top'),
('Kidney Function Test', 'KFT', 1800.00, 40, 280.00, 'Biochemistry', 'Blood', 'Red Top')
ON CONFLICT DO NOTHING;

INSERT INTO packages (pgid, package_name, price) VALUES 
('PGID001', 'FULL BODY CHECK-UP', 2700.00),
('PGID002', 'MEDICAL CHECK UP NALANDA', 2100.00),
('PGID003', 'PHI PACK', 2000.00),
('PGID004', 'TEST PACK', 3000.00)
ON CONFLICT (pgid) DO NOTHING;

-- Insert package tests (assuming test IDs exist)
-- Note: You'll need to replace the test_id values with actual UUIDs from your tests table
-- This is just an example structure
/*
INSERT INTO package_tests (package_id, test_id) VALUES 
((SELECT id FROM packages WHERE pgid = 'PGID001'), (SELECT id FROM tests WHERE short_name = 'CBC')),
((SELECT id FROM packages WHERE pgid = 'PGID001'), (SELECT id FROM tests WHERE short_name = 'BG')),
((SELECT id FROM packages WHERE pgid = 'PGID002'), (SELECT id FROM tests WHERE short_name = 'UA'))
ON CONFLICT DO NOTHING;
*/

-- Create RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
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

-- Create policies for authenticated users
CREATE POLICY "Users can view all data" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert data" ON users FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update data" ON users FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Centers can view all data" ON centers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Centers can insert data" ON centers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Centers can update data" ON centers FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "References can view all data" ON references FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "References can insert data" ON references FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "References can update data" ON references FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Tests can view all data" ON tests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Tests can insert data" ON tests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Tests can update data" ON tests FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Packages can view all data" ON packages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Packages can insert data" ON packages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Packages can update data" ON packages FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Bills can view all data" ON bills FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Bills can insert data" ON bills FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Bills can update data" ON bills FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Bill items can view all data" ON bill_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Bill items can insert data" ON bill_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Bill items can update data" ON bill_items FOR UPDATE USING (auth.role() = 'authenticated');

-- Test results table policies
CREATE POLICY "Test results can view all data" ON test_results FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Test results can insert data" ON test_results FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Test results can update data" ON test_results FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Test results can delete data" ON test_results FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Test report headers table policies
CREATE POLICY "Test report headers can view all data" ON test_report_headers FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Test report headers can insert data" ON test_report_headers FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Test report headers can update data" ON test_report_headers FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Test report headers can delete data" ON test_report_headers FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Test subcategories table policies
CREATE POLICY "Test subcategories can view all data" ON test_subcategories FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Test subcategories can insert data" ON test_subcategories FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Test subcategories can update data" ON test_subcategories FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Subcategory suggestions table policies
CREATE POLICY "Subcategory suggestions can view all data" ON subcategory_suggestions FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Subcategory suggestions can insert data" ON subcategory_suggestions FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Subcategory suggestions can update data" ON subcategory_suggestions FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Reference ranges table policies
CREATE POLICY "Reference ranges can view all data" ON reference_ranges FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Reference ranges can insert data" ON reference_ranges FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Reference ranges can update data" ON reference_ranges FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Create views for common queries
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

-- Create function to calculate bill totals
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

-- Create function to update bill totals
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

-- Create trigger to update bill totals when items change
CREATE TRIGGER update_bill_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bill_items
    FOR EACH ROW EXECUTE FUNCTION update_bill_totals();

COMMENT ON DATABASE current_database() IS 'SUWAJEEWA LABORATORIES MANAGEMENT SYSTEM DATABASE'; 

-- Admin Users management (plain password as requested)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(10) NOT NULL CHECK (role IN ('admin','staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers for updated_at
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS and permissive policy (adjust for production)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_users' AND policyname='Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON admin_users
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;