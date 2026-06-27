-- =============================================
-- CENTER-WISE PRICING MIGRATION
-- =============================================
-- Adds sparse center-specific price overrides while keeping
-- `tests.price` and `packages.price` as the global fallback.
-- Existing global prices therefore continue to work as the default
-- without copying or losing any current data.
-- Also introduces package component rows in `bill_items`
-- so package pricing can bill correctly without breaking
-- test-level report entry.
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS center_test_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(center_id, test_id)
);

CREATE TABLE IF NOT EXISTS center_package_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(center_id, package_id)
);

ALTER TABLE bill_items
    ADD COLUMN IF NOT EXISTS is_package_component BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_center_test_prices_center_id
    ON center_test_prices(center_id);
CREATE INDEX IF NOT EXISTS idx_center_test_prices_test_id
    ON center_test_prices(test_id);
CREATE INDEX IF NOT EXISTS idx_center_test_prices_center_test
    ON center_test_prices(center_id, test_id);
CREATE INDEX IF NOT EXISTS idx_center_package_prices_center_id
    ON center_package_prices(center_id);
CREATE INDEX IF NOT EXISTS idx_center_package_prices_package_id
    ON center_package_prices(package_id);
CREATE INDEX IF NOT EXISTS idx_center_package_prices_center_package
    ON center_package_prices(center_id, package_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_package_component
    ON bill_items(package_id, is_package_component);

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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_trigger
         WHERE tgname = 'update_center_test_prices_updated_at'
    ) THEN
        CREATE TRIGGER update_center_test_prices_updated_at
            BEFORE UPDATE ON center_test_prices
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_trigger
         WHERE tgname = 'update_center_package_prices_updated_at'
    ) THEN
        CREATE TRIGGER update_center_package_prices_updated_at
            BEFORE UPDATE ON center_package_prices
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

ALTER TABLE center_test_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_package_prices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'center_test_prices'
           AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated"
            ON center_test_prices
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'center_package_prices'
           AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated"
            ON center_package_prices
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE center_test_prices TO anon, authenticated;
GRANT ALL ON TABLE center_package_prices TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_test_price_for_center TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_package_price_for_center TO anon, authenticated;

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

COMMENT ON TABLE center_test_prices IS
    'Center-specific test price overrides. Falls back to tests.price when no override exists.';
COMMENT ON TABLE center_package_prices IS
    'Center-specific package price overrides. Falls back to packages.price when no override exists.';
COMMENT ON COLUMN bill_items.is_package_component IS
    'True for hidden child test rows generated from a billed package.';
COMMENT ON FUNCTION get_test_price_for_center IS
    'Returns the center override for a test or falls back to the global test price.';
COMMENT ON FUNCTION get_package_price_for_center IS
    'Returns the center override for a package or falls back to the global package price.';
