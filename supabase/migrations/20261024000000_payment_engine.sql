-- Fase funcional: pagos simulados. Revisar y aplicar UNA VEZ en Supabase,
-- despuÃ©s de generar un respaldo. Compatible con el esquema suministrado.
BEGIN;
ALTER TABLE public.pago ADD COLUMN IF NOT EXISTS id_usuario INTEGER;
ALTER TABLE public.pago ADD COLUMN IF NOT EXISTS transaccion_id VARCHAR(100);
-- Rechazos se guardan sin crear suscripciones ficticias.
ALTER TABLE public.pago ALTER COLUMN id_suscripcion DROP NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.pago'::regclass
          AND conname = 'pago_usuario_fkey'
    ) THEN
        ALTER TABLE public.pago
        ADD CONSTRAINT pago_usuario_fkey
        FOREIGN KEY (id_usuario)
        REFERENCES public.usuario(id);
    END IF;
END $$;
-- Backfill: conservar pagos histÃ³ricos asociados a suscripciÃ³n.
UPDATE public.pago AS p SET id_usuario = s.id_usuario
FROM public.suscripcion AS s WHERE p.id_suscripcion = s.id AND p.id_usuario IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pago_referencia_unique_not_null ON public.pago(referencia) WHERE referencia IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pago_transaccion_unique_not_null ON public.pago(transaccion_id) WHERE transaccion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pago_usuario_history_idx ON public.pago(id_usuario,id DESC);
COMMIT;
