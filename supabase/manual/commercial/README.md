# Etapa 2 comercial — revisión y aplicación manual pendientes

**Decisión confirmada:** esperar hasta disponer del backend comercial actualizado y coordinar su activación. Tener el artefacto listo antes de la ventana de mantenimiento; aplicar SQL y activar backend bajo esa misma ventana. No publicar Fase 8 completa sin delimitar las funcionalidades todavía no adaptadas.

**No ejecutado en Supabase.** No ejecutar migraciones históricas, el renombrado ni el SQL de seguridad de etapa 1: estos cambios ya están aplicados y verificados.

1. Revisar `20261027_inspeccion.sql` y guardar su resultado completo fuera de Git antes de cualquier aplicación. Es de solo lectura; incluye definiciones, hashes, ACL, triggers, catálogo y conteos sin datos de contacto.
2. Comparar las cinco RPC contra `20261027_rpc_manifest.json`. Los hashes `old` proceden de los cuerpos reales ya verificados, no de asumir migraciones pendientes. El preflight acepta esas versiones o esta misma entrega; cualquier otra versión cancela la transacción. No omitir sus guardas para forzar una instalación.
3. Revisar los precios, capacidades y vigencias de planes con suscripciones frente a la evidencia comercial disponible. El script impide futuras revaloraciones; no reconstruye ni corrige tarifas que pudieran haberse modificado antes de esta entrega. No inventar un backfill a partir de pagos netos de créditos.
4. En una ventana coordinada de los endpoints comerciales, el operador decide ejecutar **solo** `20261027_etapa2.sql` completo en SQL Editor. Es transaccional y usa lock_timeout de 10 segundos; un fallo cancela toda la instalación. Si queda una transacción abortada, cerrar con ROLLBACK en esa sesión antes de revisar el motivo. No añadir CASCADE ni quitar validaciones.
5. Activar esta versión del backend, guardar otra inspección y contrastar hashes `next`. La definición de `cloudbox_assign_free_after_user_insert` debe ser idéntica a la captura previa, igual que sus vínculos. El cron existente mantiene nombre, agenda y firma de worker; no se recrea ni se ejecuta desde estas herramientas.
6. Validar manualmente con cuentas de prueba propias: alta pagada desde Free, subscribe bloqueado sobre plan pagado, upgrade con crédito, rechazo sin cambio de vigencia, downgrade/cancelación efectivos al día siguiente de fecha_fin, renovación conservando días, consulta/uso en el último día y reportes. Observar las ejecuciones normales del cron; no lanzar globalmente el worker sobre producción como prueba.

El script no cambia filas, fechas existentes, precios, saldos, pagos, programaciones ni permisos de seguridad de etapa 1. Sustituye cinco funciones manteniendo nombres, argumentos y respuestas; añade dos funciones de trigger y dos triggers para proteger catálogo y serializar adquisición/edición de tarifas. Conserva la función real Free y el trigger existente que bloquea renovaciones con programación pendiente.

`20261027_etapa2_rollback.sql` se entrega **para revisión de contingencia**, no para ejecutar de rutina. Exige los cuerpos RPC de esta entrega, restaura las cinco definiciones anteriores y elimina únicamente los dos triggers/funciones añadidos. No revierte transacciones comerciales ni modifica datos. Reintroduce los defectos de la versión anterior y debe coordinarse con el backend y los cambios comerciales ocurridos entretanto. Ante cualquier deriva, usar las definiciones capturadas y revisar dependencias antes de restaurar.

## Reproducción exclusivamente local

```powershell
docker run --name cloudbox-commercial-stage2 --network none --label cloudbox.task=commercial-stage2 -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:17
docker exec cloudbox-commercial-stage2 pg_isready -U postgres
node backend/scripts/test-commercial-stage2.js
docker rm -fv cloudbox-commercial-stage2
```

Esperar que pg_isready confirme disponibilidad. El runner valida imagen/etiqueta/red/montajes y usa una base temporal con datos ficticios. Reconstruye el baseline renombrado solo dentro del contenedor, incluyendo las definiciones históricas necesarias y una reproducción del comportamiento Free realmente exportado. Esa reconstrucción **no es** un procedimiento de despliegue ni certifica internamente Supabase Auth. Las RPC de compra/cambio se ejercitan con service_role y RLS activo. El runner elimina su base al terminar; retirar después el contenedor y su volumen desechable.
