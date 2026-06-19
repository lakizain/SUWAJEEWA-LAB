-- Add discount_type column to bills table
-- Supports percentage (percent) or fixed amount (fixed) discounts

ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) DEFAULT 'percent';

COMMENT ON COLUMN public.bills.discount_type IS 'Discount mode: percent or fixed (Rs amount)';
