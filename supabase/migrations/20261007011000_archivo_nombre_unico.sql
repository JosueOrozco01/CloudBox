-- Prevent duplicate active file names within the same folder.
-- File names are compared without case sensitivity.

CREATE UNIQUE INDEX IF NOT EXISTS uq_archivo_activo_nombre_carpeta
ON public.archivo (
    id_usuario,
    COALESCE(id_carpeta, -1),
    LOWER(nombre)
)
WHERE id_estado = 1;
