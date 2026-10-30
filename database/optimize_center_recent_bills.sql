CREATE INDEX IF NOT EXISTS idx_bills_center_created_at
ON public.bills (center_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id
ON public.bill_items (bill_id);
