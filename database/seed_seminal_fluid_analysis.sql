-- ============================================================
-- Seed: SEMINAL FLUID ANALYSIS (SFA)
-- Test ID: 982bd0fa-4f9c-4bc1-a417-6c130c912975
--
-- What this script does (for this one test only):
--   1. Removes the existing subcategories (and their suggestions /
--      reference ranges) so the report starts from a clean list.
--   2. Inserts the subcategories in the required display order.
--      MOTILITY and MORPHOLOGY are marked is_bold = TRUE so they
--      appear as highlighted "topic" headers.
--   3. Adds value suggestions (report-entry autocomplete tags) for
--      each subcategory.
--   4. Adds reference ranges so the report is fully populated.
--
-- Reference values used (WHO 2021 lower reference limits):
--   Volume >= 1.4 mL          pH 7.2 - 8.0
--   Total sperm number >= 39 x 10^6 per ejaculate
--   Sperm concentration >= 16 x 10^6 per mL
--   Progressive motility >= 30 %
--   Normal forms >= 4 %
--   Leucocytes (pus cells) < 1 x 10^6 per mL
--   Liquefaction within 60 minutes
--
-- This script is safe to re-run: rows for this test are deleted
-- first, then re-inserted.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_test_id UUID := '982bd0fa-4f9c-4bc1-a417-6c130c912975';
  r         RECORD;
BEGIN
  -- Sanity check: the test must exist
  IF NOT EXISTS (SELECT 1 FROM tests WHERE id = v_test_id) THEN
    RAISE EXCEPTION 'Test % not found. Aborting seed.', v_test_id;
  END IF;

  -- ---------------------------------------------------------
  -- 0. Clean slate for this test
  -- ---------------------------------------------------------
  DELETE FROM reference_ranges WHERE test_id = v_test_id;
  DELETE FROM subcategory_suggestions
   WHERE subcategory_id IN (SELECT id FROM test_subcategories WHERE test_id = v_test_id);
  DELETE FROM test_subcategories WHERE test_id = v_test_id;

  -- ---------------------------------------------------------
  -- 1. Subcategories in display order
  --    is_bold = TRUE  ->  highlighted "topic" header
  -- ---------------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES
      (1,  'COLOUR',            NULL::text, 0, FALSE),
      (2,  'APPEARANCE',        NULL::text, 0, FALSE),
      (3,  'VOLUME',            'mL',       1, FALSE),
      (4,  'LIQUEFACTION TIME', 'min',      0, FALSE),
      (5,  'REACTION',          NULL::text, 1, FALSE),
      (6,  'VISCOSITY',         NULL::text, 0, FALSE),
      (7,  'TOTAL COUNT',       '10^6/mL',  2, FALSE),
      (8,  'MOTILITY',          NULL::text, 0, TRUE),
      (9,  'ACTIVE',            '%',        0, FALSE),
      (10, 'SLUGGISH',          '%',        0, FALSE),
      (11, 'NON PROGRESSIVE',   '%',        0, FALSE),
      (12, 'DEAD',              '%',        0, FALSE),
      (13, 'MORPHOLOGY',        NULL::text, 0, TRUE),
      (14, 'NORMAL',            '%',        0, FALSE),
      (15, 'ABNORMAL FORMS',    '%',        0, FALSE),
      (16, 'PUS CELLS',         NULL::text, 0, FALSE),
      (17, 'RED CELLS',         NULL::text, 0, FALSE),
      (18, 'MACROPHAGES',       NULL::text, 0, FALSE),
      (19, 'OTHERS',            NULL::text, 0, FALSE)
    ) AS t(sort_order, subcategory_name, uom, decimal_places, is_bold)
    ORDER BY sort_order
  LOOP
    INSERT INTO test_subcategories
      (test_id, subcategory_name, uom, sort_order, decimal_places, is_bold)
    VALUES
      (v_test_id, r.subcategory_name, r.uom, r.sort_order, r.decimal_places, r.is_bold);
  END LOOP;

  -- ---------------------------------------------------------
  -- 2. Value suggestions (autocomplete tags) per subcategory
  -- ---------------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES
      ('COLOUR','Grey White'),
      ('COLOUR','Pearly White'),
      ('COLOUR','Opalescent'),
      ('COLOUR','Pale Yellow'),
      ('COLOUR','Yellow'),
      ('COLOUR','Brownish'),
      ('COLOUR','Translucent'),

      ('APPEARANCE','Homogeneous'),
      ('APPEARANCE','Normal'),
      ('APPEARANCE','Thin'),
      ('APPEARANCE','Thick'),
      ('APPEARANCE','Turbid'),
      ('APPEARANCE','Clear'),

      ('VOLUME','1.4'),
      ('VOLUME','1.5'),
      ('VOLUME','2.0'),
      ('VOLUME','2.5'),
      ('VOLUME','3.0'),
      ('VOLUME','3.5'),
      ('VOLUME','4.0'),

      ('LIQUEFACTION TIME','15'),
      ('LIQUEFACTION TIME','20'),
      ('LIQUEFACTION TIME','30'),
      ('LIQUEFACTION TIME','45'),
      ('LIQUEFACTION TIME','60'),

      ('REACTION','Alkaline'),
      ('REACTION','7.2'),
      ('REACTION','7.4'),
      ('REACTION','7.6'),
      ('REACTION','8.0'),

      ('VISCOSITY','Normal'),
      ('VISCOSITY','Increased'),
      ('VISCOSITY','Decreased'),
      ('VISCOSITY','Viscous'),

      ('TOTAL COUNT','16'),
      ('TOTAL COUNT','20'),
      ('TOTAL COUNT','40'),
      ('TOTAL COUNT','60'),
      ('TOTAL COUNT','80'),
      ('TOTAL COUNT','100'),

      ('ACTIVE','30'),
      ('ACTIVE','40'),
      ('ACTIVE','50'),
      ('ACTIVE','60'),
      ('ACTIVE','70'),

      ('SLUGGISH','10'),
      ('SLUGGISH','20'),
      ('SLUGGISH','30'),

      ('NON PROGRESSIVE','5'),
      ('NON PROGRESSIVE','10'),
      ('NON PROGRESSIVE','15'),
      ('NON PROGRESSIVE','20'),

      ('DEAD','10'),
      ('DEAD','20'),
      ('DEAD','30'),
      ('DEAD','40'),

      ('NORMAL','4'),
      ('NORMAL','5'),
      ('NORMAL','10'),
      ('NORMAL','15'),
      ('NORMAL','20'),
      ('NORMAL','30'),

      ('ABNORMAL FORMS','70'),
      ('ABNORMAL FORMS','80'),
      ('ABNORMAL FORMS','90'),
      ('ABNORMAL FORMS','95'),

      ('PUS CELLS','Nil'),
      ('PUS CELLS','Occasional'),
      ('PUS CELLS','1-2 /HPF'),
      ('PUS CELLS','3-4 /HPF'),
      ('PUS CELLS','5-6 /HPF'),
      ('PUS CELLS','8-10 /HPF'),
      ('PUS CELLS','Plenty'),

      ('RED CELLS','Nil'),
      ('RED CELLS','Occasional'),
      ('RED CELLS','1-2 /HPF'),
      ('RED CELLS','3-4 /HPF'),
      ('RED CELLS','Plenty'),

      ('MACROPHAGES','Nil'),
      ('MACROPHAGES','Occasional'),
      ('MACROPHAGES','Plenty'),

      ('OTHERS','Nil'),
      ('OTHERS','Not detected')
    ) AS t(subcategory_name, suggestion_text)
  LOOP
    INSERT INTO subcategory_suggestions (subcategory_id, suggestion_text, suggestion_type)
    SELECT id, r.suggestion_text, 'tag'
    FROM test_subcategories
    WHERE test_id = v_test_id AND subcategory_name = r.subcategory_name;
  END LOOP;

  -- ---------------------------------------------------------
  -- 3. Reference ranges (WHO 2021 lower reference limits)
  -- ---------------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES
      ('VOLUME',            'Male', '1.4',  NULL::text, 'mL'),
      ('LIQUEFACTION TIME', 'Male', NULL::text, '<60',  'min'),
      ('REACTION',          'Male', '7.2',  '8.0',      NULL::text),
      ('TOTAL COUNT',       'Male', '16',   NULL::text, '10^6/mL'),
      ('ACTIVE',            'Male', '30',   NULL::text, '%'),
      ('NORMAL',            'Male', '4',    NULL::text, '%'),
      ('PUS CELLS',         'Male', NULL::text, '<1',   '10^6/mL')
    ) AS t(subcategory_name, gender, min_value, max_value, unit)
  LOOP
    INSERT INTO reference_ranges
      (test_id, subcategory_id, gender, age_min, age_max, min_value, max_value, unit)
    SELECT v_test_id, id, r.gender, NULL, NULL, r.min_value, r.max_value, r.unit
    FROM test_subcategories
    WHERE test_id = v_test_id AND subcategory_name = r.subcategory_name;
  END LOOP;

  RAISE NOTICE 'Seminal fluid analysis (SFA) seeded: 19 subcategories, 83 suggestions, 7 reference ranges.';
END $$;

COMMIT;
