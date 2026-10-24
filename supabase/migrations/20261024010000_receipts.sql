-- Ejecutar SOLO tras revisar estado real de tabla y tener copia de seguridad.
BEGIN;
LOCK TABLE public.comprobante_pago IN ACCESS EXCLUSIVE MODE;
CREATE SEQUENCE IF NOT EXISTS public.comprobante_pago_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.comprobante_pago_numero_seq START WITH 100001;
SELECT setval('public.comprobante_pago_id_seq', COALESCE((SELECT MAX(id) FROM public.comprobante_pago), 0) + 1, false);
SELECT setval('public.comprobante_pago_numero_seq', GREATEST(COALESCE((SELECT MAX(numero_comprobante) FROM public.comprobante_pago), 0) + 1, 100001), false);
ALTER TABLE public.comprobante_pago ALTER COLUMN id SET DEFAULT nextval('public.comprobante_pago_id_seq');
ALTER TABLE public.comprobante_pago ALTER COLUMN numero_comprobante SET DEFAULT nextval('public.comprobante_pago_numero_seq');
CREATE UNIQUE INDEX IF NOT EXISTS comprobante_pago_unico_por_pago ON public.comprobante_pago(id_pago);
COMMIT;
