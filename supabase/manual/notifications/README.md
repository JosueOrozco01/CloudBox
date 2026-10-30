# Etapa 3 — revisión manual pendiente, sin aplicación remota

Fuente: esquema real exportado; `notificacion` existe, identity integer, fecha_creacion DATE, leida boolean NOT NULL. No ejecutar la migración histórica que intenta crear esa tabla. No ejecutar SQL comercial de etapa 2 ni seguridad de etapa 1 para probar esta entrega.

## Instalación futura autorizada

1. Disponer del backend actualizado y coordinar su despliegue. Esta entrega no autoriza aplicar nada todavía. El SQL comercial de etapa 2 mantiene su espera acordada; no se aplica automáticamente como dependencia de notificaciones.
2. Revisar/guardar `20261027_inspeccion.sql` antes de la instalación. Es de solo lectura y funciona con la tabla original, antes de añadir columnas. Guardar capturas fuera de Git. Conservar OID, columnas, FK, ACL, conteos y hashes de Free/RPC comerciales.
3. Revisar `20261027_etapa3.sql` completo. Añade exclusivamente extensiones y objetos nuevos, no actualiza filas históricas. Su preflight aborta ante conflictos de nombres/tipos/cuerpos de funciones o permisos heredados inesperados. No quitar guardas, forzar CASCADE ni cambiar la función Free para hacerlo pasar.
El script incluye NOTIFY pgrst, 'reload schema' antes del COMMIT para actualizar la caché de la Data API cuando se confirme la transacción. Ver https://supabase.com/kb/troubleshooting/refresh-postgrest-schema. Validar su efecto mediante la API tras el despliegue; no basta la inspección de pg_proc.

4. Cuando el usuario autorice el despliegue, coordinar la instalación manual y activación del backend. El CRUD actualizado necesita estas columnas y el productor interno necesita la RPC nueva. Las firmas/cuerpos RPC comerciales se conservan; los triggers funcionan con la versión instalada y con las correcciones de etapa 2 cuando se apliquen después. Preferir una única ventana de integración autorizada para las versiones que se vayan a activar.
5. Ejecutar inspección posterior y `20261027_verificacion.sql`, solo lectura. Deben existir cuatro triggers, los índices de bandeja/no leídas y la PK del registro de deduplicación. Clientes anon/authenticated sin lectura/escritura directa ni EXECUTE; service_role conserva acceso interno. Comparar con captura previa: OID/identity/FK originales y hashes Free/comerciales iguales. Los nuevos avisos pueden aumentar los conteos si hubo operaciones reales tras instalar.
6. Realizar pruebas funcionales con cuentas/recursos propios de prueba, según el informe de etapa 3. No ejecutar globalmente el cron como experimento. Observar sus ejecuciones normales y las advertencias sanitizadas del productor en los logs.

El script usa BEGIN/COMMIT y lock_timeout de 10 segundos; un error aborta la instalación. Si la sesión queda en transacción fallida, cerrar con ROLLBACK y revisar el motivo. No se envían emails, push ni WebSockets. No se promete entrega garantizada ni recuperación automática de eventos anteriores a instalar.

## Persistencia y fallos

- `leida` es la autoridad. Las filas antiguas, incluso tipos desconocidos/nulos y títulos de 255 caracteres, se conservan. No se convierten DATE ni IDs ni se cambia la FK original.
- `tipo_recurso`, `id_recurso`, `fecha_lectura` son columnas aditivas nullable. Para los históricos no se inventa fecha_lectura: leida=true/fecha_lectura=NULL es válido. Solo una transición efectiva false→true desde la API guarda la hora observada. Repetir lectura conserva esa hora.
- `cloudbox_notification_event` es un registro mínimo de idempotencia (usuario/tipo/clave), no una cola. Permanece al borrar un aviso. No contiene cuerpo, tokens, contraseñas ni enlaces firmados. No vaciarlo como tarea de limpieza: permitiría reenviar duplicados.
- Los cuatro triggers AFTER observan siete eventos de negocio. Aviso y marca se escriben en la misma transacción: solo son visibles después del commit y desaparecen si la operación principal revierte. Una excepción ordinaria del productor revierte su subtransacción y emite una advertencia genérica, conservando la operación principal. Una entrega fallida no deja una marca que bloquee un reintento explícito.
- No existe doble emisión JS+SQL para el mismo evento. `createNotification` conserva NOT-01 y usa la RPC interna para deduplicar; `notifyAfterCommit` sigue disponible para consumidores internos futuros y no propaga errores secundarios. No hay POST público de creación.

## Contingencia

`20261027_etapa3_rollback.sql` desactiva únicamente los cuatro triggers productores, tras comprobar sus definiciones. Conserva la tabla original, avisos, leida, fechas observadas, columnas, índices, RPC de creación y registro de idempotencia. Así el CRUD sigue funcionando y una reaplicación no elimina datos ni reenvía avisos borrados. No restaura grants amplios de clientes. Revisar backend/datos antes de ejecutar; no es un procedimiento automático ni un rollback comercial.

## Prueba exclusivamente local

```powershell
docker run --name cloudbox-notifications-stage3 --network none --label cloudbox.task=notifications-stage3 -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:17
docker exec cloudbox-notifications-stage3 pg_isready -U postgres
node backend/scripts/test-notifications-stage3.js
docker rm -fv cloudbox-notifications-stage3
```

Esperar disponibilidad de PostgreSQL. El runner valida imagen, etiqueta, red y montajes. Solo aplica el fixture estructural ficticio y el SQL de etapa 3. No carga .env, no acepta conexiones remotas ni ejecuta migraciones históricas/SQL comercial. La función Free del fixture reproduce el comportamiento exportado, sin pretender recrear internamente Supabase Auth.
