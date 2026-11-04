# Revisión del SQL actual de CloudBox

Fecha: 3 de noviembre de 2026. Rama revisada: `fix-problems`.
Última validación local: 4 de noviembre de 2026.
Referencia: esquema de 29 tablas proporcionado por la usuaria, antes de ejecutar la migración de correcciones.

## Resultado

La estructura enviada coincide con los nombres, tipos y relaciones que necesita la migración `20261103000000_fix_audit_consistency.sql`. No se identificó un cambio obligatorio en los nombres de las 29 tablas existentes, en los identificadores de catálogo ni en los tipos de sus columnas para instalarla. Las cuatro tablas incorporadas por la migración utilizan nombres en español.

La instalación de la migración se ejecutó dos veces por escenario en una base local derivada de las 29 tablas, conservando sus claves foráneas, identidades, restricciones `NOT NULL`, `UNIQUE` y `CHECK`. Se comprueba la instalación desde el esquema actual y la actualización de una instalación anterior con nombres en inglés. La prueba automatizada terminó aprobada: 10 resultados correctos y 0 fallos. Comprueba cuota y borrado físico pendiente, integridad de carpetas, creación atómica y cierre de tickets, preferencias de notificaciones y aislamiento de acceso. También ejecuta las consultas de comprobación antes y después de instalar la migración.

Esto valida compatibilidad de estructura, pero no permite certificar los datos existentes, los cuerpos de funciones instaladas, los permisos o todos los triggers remotos. Esos elementos no están incluidos en el texto proporcionado.

## Lo que está correctamente alineado

- Las tablas comerciales usan `plan`, `suscripcion`, `pago`, `credito_suscripcion`, `programacion_suscripcion` y `evento_credito_suscripcion`, como espera el código actual.
- `usuario.espacio_usado_by` y `archivo.tamano_bytes` son `bigint`, adecuados para capacidades superiores a 2 GB.
- `usuario.auth_user_id` es UUID, obligatorio, único y relacionado con `auth.users`; se conserva una vinculación explícita entre identidad y perfil.
- Los precios y capacidades usan `numeric` y tienen restricciones de valores válidos.
- Los archivos, actividad y expiración de compartidos incluyen marcas de tiempo con zona horaria.
- La tabla `cloudbox_notification_event` está presente para la deduplicación del sistema de notificaciones. El esquema, por sí solo, no demuestra qué función o triggers la utilizan actualmente.

## Catálogos comprobados por lectura

Se consultaron únicamente catálogos y metadatos del Supabase configurado en el backend. No se modificaron registros ni se consultaron documentos personales.

| Catálogo | Valores comprobados |
| --- | --- |
| Estado de archivo | 1 = Activo; 2 = En papelera; 3 = Eliminado. |
| Estado de carpeta | 1 = Activo; 2 = En papelera. |
| Estado de plan | 1 = Activo; 2 = Inactivo. |
| Estado de suscripción | 1 = Pendiente; 2 = Activa; 3 = PorVencer; 4 = Vencida; 5 = Renovada; 6 = Cancelada. |
| Free | ID 8; precio Q0; capacidad 1 GB; vigencia 36500 días; estado 1. |

Estos valores coinciden con las condiciones utilizadas por la migración. Free puede conservar el ID 8: el código y el trigger lo buscan por nombre, precio, capacidad y estado, sin exigir que su ID sea 1.

## Diferencias esperadas antes de migrar

| Elemento | SQL actual | Lo que incorpora la migración |
| --- | --- | --- |
| `lectura_notificacion_administrador` | No aparece en el SQL actual. | Lecturas persistentes de notificaciones administrativas. |
| `solicitud_soporte` | No aparece en el SQL actual. | Solicitudes de soporte. |
| `mensaje_soporte` | No aparece en el SQL actual. | Mensajes y control transaccional de respuestas. |
| `limpieza_almacenamiento` | No aparece en el SQL actual. | Limpieza pendiente de objetos de cargas fallidas. |
| `archivo.storage_deleted_at` | No aparece. | Confirmación del borrado físico de cada archivo. |

La migración añade cuatro tablas y una columna al modelo proporcionado. La cantidad esperada de tablas públicas de este alcance pasa de 29 a 33. También instala funciones, triggers, índices y permisos; esos objetos no se contabilizan como tablas.

Si una instalación anterior contiene `admin_notification_read`, `support_ticket`, `support_message` o `cloudbox_storage_cleanup`, la migración actual las renombra a sus equivalentes en español, conservando registros, claves foráneas e identidades. Se probaron la conservación de una solicitud, su mensaje y una entrada de limpieza, y la creación posterior de nuevos registros. Si existen simultáneamente el nombre antiguo y el nuevo, se interrumpe la transacción para revisar el conflicto; esta protección también se comprobó localmente. El backend, sus scripts y las pruebas consultan los nombres nuevos.

## Observaciones que conviene conservar

1. **Nombre de auditoría.** La API encuentra `LogAuditoria` con mayúsculas y rechaza `logauditoria` en minúsculas. Las consultas SQL deben utilizar `public."LogAuditoria"`, como ya hace la migración. No renombrar la tabla. PostgreSQL distingue los identificadores entre comillas; los identificadores sin comillas se convierten a minúsculas. [Referencia oficial de PostgreSQL](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS).
2. **Vigencia de Free.** `plan.vigencia_dias` y `suscripcion.fecha_fin` son obligatorios. El valor de Free de 36500 días es compatible con esa estructura. No se necesita introducir `NULL` ni poner la vigencia en cero para esta migración.
3. **Archivos vacíos.** La tabla permite tamaños de cero bytes por su `CHECK >= 0`. La aplicación y el nuevo trigger restringen las nuevas cargas a archivos de tamaño positivo. La migración no elimina ni modifica automáticamente los archivos históricos de cero bytes.
4. **Precisión de fechas.** `carpeta.fecha_creacion`, `carpeta.fecha_modificacion` y `notificacion.fecha_creacion` son `date`. Es compatible con la migración, aunque no conserva la hora dentro del día. Pasarlas a `timestamptz` sería una mejora adicional, no un requisito para este cambio.
5. **Exportación de contexto.** Los campos escritos como `ARRAY` en `eliminacion_carpeta` representan arreglos de enteros, según sus valores predeterminados. El texto enviado también tiene dependencias fuera de orden y una secuencia referenciada sin definición. Debe conservarse como referencia; no ejecutarse como instalación o respaldo completo.
6. **Borrados históricos.** Los registros de archivo en estado 3 no indican, por sí solos, si el objeto ya desapareció de Storage. Al añadir la nueva columna, quedarán pendientes de confirmación. Pueden reaparecer como pendientes y volver a contabilizarse hasta verificarlos mediante el reconciliador.
7. **Índices y restricciones no visibles.** No se puede concluir, solo con este texto, si faltan los índices únicos de archivos/favoritos o la restricción que exige exactamente un recurso en `compartir`. Hay que consultar el catálogo real antes de añadirlos de nuevo.

## Comprobación recomendada antes de aplicar el cambio

Se preparó `supabase/manual/review/20261103_pre_migration_check.sql`. Contiene consultas de solo lectura para revisar:

- Existencia de tablas y columnas.
- Catálogos y definición de Free.
- Duplicados de carpetas, archivos y favoritos.
- Carpetas con padre no disponible o recorridos cíclicos.
- Compartidos con ambos recursos o sin ninguno.
- Suscripciones vigentes simultáneas y rutas de Storage utilizadas por más de un registro.
- Cantidad de registros históricos eliminados que requieren verificación física.
- Índices, restricciones, triggers, políticas RLS y firmas de funciones existentes.

Los contadores de inconsistencias deben revisarse antes de publicar las nuevas restricciones. Un contador de borrados históricos distinto de cero es una situación que debe reconciliarse, no prueba de corrupción ni permiso para borrar objetos sin verificar sus referencias.

## Cambios realizados durante esta revisión

Se amplió la prueba de base de datos para usar las 29 definiciones públicas del contexto, en lugar de las tablas mínimas anteriores. El archivo `backend/tests/fixtures/current-public-schema.sql` es exclusivamente una referencia de pruebas locales. Sus únicas adaptaciones estructurales son el orden de dependencias, los arreglos `integer[]`, las comillas del nombre real de auditoría y la creación local de la secuencia referenciada. Los esquemas administrados `auth` y `storage` utilizan representaciones de prueba.

La validación local aprobada se puede repetir desde la raíz del repositorio con:

```powershell
node --max-old-space-size=256 --max-semi-space-size=4 --wasm-lazy-compilation --liftoff-only --test backend/tests/audit-database.test.js
```

Se actualizaron los nombres de las cuatro tablas incorporadas por la migración, sus referencias en el backend y las consultas de comprobación. La batería completa del backend también se repitió: 128 resultados correctos, además de los 10 de PostgreSQL. No se ejecutó la migración sobre Supabase. La activación del código de `fix-problems` sigue requiriendo aplicarla y validar después los flujos en el proyecto de destino.
