-- Production safety: remove the historical write-capable split simulator.
DROP FUNCTION IF EXISTS public.simulate_mototaxi_split_payment(uuid, uuid, numeric);
