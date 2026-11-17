UPDATE public.test_subcategories
SET subcategory_name = 'Ideal Weight'
WHERE test_id = '3b5166cc-755f-433e-833c-7e8c746c13ce'
  AND lower(btrim(subcategory_name)) = 'ideal weight range';
