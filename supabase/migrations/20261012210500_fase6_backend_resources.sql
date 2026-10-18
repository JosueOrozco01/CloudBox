-- CloudBox - Phase 6
-- Integrity preparation for Sharing, Favorites, and Activity.


-- ============================================================
-- SHARING
-- A record must represent exactly one file
-- or one folder, never both and never neither.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_compartir_archivo_o_carpeta'
          AND conrelid = 'public.compartir'::regclass
    ) THEN
        ALTER TABLE public.compartir
        ADD CONSTRAINT chk_compartir_archivo_o_carpeta
        CHECK (
            (id_archivo IS NOT NULL AND id_carpeta IS NULL)
            OR
            (id_archivo IS NULL AND id_carpeta IS NOT NULL)
        );
    END IF;
END
$$;


-- ============================================================
-- FAVORITES
-- Prevents a user from adding the same file twice.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_favorito_usuario_archivo
ON public.favorito (
    id_usuario,
    id_archivo
);


-- ============================================================
-- ACTIVITY
-- Allows recording folder-related actions.
-- ============================================================

ALTER TABLE public.actividad
ADD COLUMN IF NOT EXISTS id_carpeta integer;


-- If a file is permanently deleted,
-- the activity history is preserved.
ALTER TABLE public.actividad
DROP CONSTRAINT IF EXISTS fk_actividad_archivo;

ALTER TABLE public.actividad
ADD CONSTRAINT fk_actividad_archivo
FOREIGN KEY (id_archivo)
REFERENCES public.archivo(id)
ON DELETE SET NULL;


-- If a folder is permanently deleted,
-- its history is also preserved.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_actividad_carpeta'
          AND conrelid = 'public.actividad'::regclass
    ) THEN
        ALTER TABLE public.actividad
        ADD CONSTRAINT fk_actividad_carpeta
        FOREIGN KEY (id_carpeta)
        REFERENCES public.carpeta(id)
        ON DELETE SET NULL;
    END IF;
END
$$;


-- ============================================================
-- ACTION CATALOG
-- Actions required for Phase 6.
-- ============================================================

INSERT INTO public.accion (nombre, descripcion)
VALUES
    ('Crear carpeta', 'El usuario creó una carpeta'),
    ('Subir archivo', 'El usuario subió un archivo'),
    ('Descargar archivo', 'El usuario descargó un archivo'),
    ('Eliminar archivo', 'El usuario eliminó un archivo'),
    ('Compartir archivo', 'El usuario compartió un archivo'),
    ('Compartir carpeta', 'El usuario compartió una carpeta'),
    ('Eliminar carpeta', 'El usuario eliminó una carpeta')
ON CONFLICT (nombre) DO NOTHING;