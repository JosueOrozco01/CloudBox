ALTER TABLE public.compartir
ALTER COLUMN fecha_expiracion
TYPE TIMESTAMPTZ
USING
    CASE
        WHEN fecha_expiracion IS NULL THEN NULL
        ELSE fecha_expiracion::timestamp AT TIME ZONE 'UTC'
    END;
