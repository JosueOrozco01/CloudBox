# Correcciones de CloudBox

Fecha: 3 de noviembre de 2026. Rama: `fix-problems`.
Base: `origin/develop`, commit `dc2e1aa67f30f6441434f1501eba22ff42cb9093`.

Se descargó la referencia de develop y se comprobó que no existían commits nuevos respecto de la copia local. La rama de correcciones se creó a partir de esa versión. Se conservaron los respaldos, documentos y archivos locales existentes.

## Alcance y estado

Revisión visual del 4 de noviembre completada: se corrigieron las inconsistencias de tema oscuro, controles, distribución y representación del almacenamiento conservando el diseño. El frontend tiene 15 pruebas aprobadas y un recorrido de navegador aprobado de 23 rutas. El detalle actual y los pendientes funcionales están en `docs/REVISION_VISUAL_Y_FUNCIONAL_2026-11-04.md`.

Estado remoto confirmado el 4 de noviembre: la usuaria aplicó la migración completa en Supabase. Las comprobaciones de lectura posteriores encontraron las tablas nuevas, la columna de confirmación de borrado y la función de soporte. También pasaron las consultas administrativas y el reporte de almacenamiento. Se contabilizaron 22 elementos de limpieza pendientes, sin procesarlos. Queda pendiente probar los flujos desde la interfaz con cuentas de cliente y administrador. Las referencias a instalación pendiente que siguen describen el estado previo a esta confirmación.

Las correcciones corresponden a los veinte hallazgos de la auditoría del 1 de noviembre. También se corrigieron problemas descubiertos al ejecutar la batería completa: resolución de módulos en pruebas antiguas, fechas dependientes de zona horaria, selectores visuales desactualizados y consultas administrativas que ocultaban errores o terminaban prematuramente al recibir páginas pequeñas.

El código de esta rama requiere la migración `20261103000000_fix_audit_consistency.sql` antes de publicarse. Esa migración fue ejecutada en PostgreSQL embebido de prueba, incluida una segunda ejecución para comprobar su repetición segura. No se instaló en Supabase remoto. Su instalación requiere ejecutar SQL administrativo en el proyecto de destino; no se realiza automáticamente desde la API ni al iniciar el backend.

Actualización del 4 de noviembre: las tablas incorporadas se llaman `notificacion_administrador`, `solicitud_soporte`, `mensaje_soporte` y `limpieza_almacenamiento`. El backend, los scripts y las pruebas utilizan esos nombres. La migración también contempla la actualización de instalaciones anteriores con nombres en inglés, conservando sus registros, relaciones e identidades.

La comprobación remota de lectura sigue indicando que faltan las tablas complementarias y la función de creación de tickets en la API consultada. La nueva columna `archivo.storage_deleted_at` tampoco está instalada. Por tanto, las correcciones que dependen de SQL están preparadas y probadas localmente; su activación en la nube queda pendiente de instalar la migración en el proyecto utilizado por el despliegue.

## Relación con la auditoría

| Hallazgo | Corrección | Dependencia de instalación |
| --- | --- | --- |
| CB-01 | Migración repetible que reconcilia soporte, lecturas administrativas y función de creación de tickets. Comprobador alineado con la prioridad de claves del backend. | Aplicar SQL en el proyecto correcto. |
| CB-02 | Comprobación común de pertenencia de rutas antes de firmar o eliminar avatares. Se cubren perfil, listados y detalle administrativo. Los metadatos malformados no bloquean todo el perfil. | Código. |
| CB-03 | Se retiraron los diagnósticos públicos con efectos. `/health` es una comprobación mínima. Se añadieron límites de autenticación y un límite por destinatario para recuperación y reenvío. | Configurar proxy y límites compartidos si se utilizan varias réplicas. |
| CB-04 | Free se obtiene exclusivamente de la política comercial. Si falta, la operación falla explícitamente; no se utiliza un plan pagado ni un ID inventado. | Catálogo Free Q0/1 GB activo. |
| CB-05 | Trigger transaccional que bloquea la fila del propietario y comprueba el consumo antes de confirmar archivos. Una carga rechazada limpia su objeto; los reintentos fallidos de limpieza quedan en una cola. | Aplicar SQL. |
| CB-06 | Se distingue borrado lógico de borrado físico confirmado. Los pendientes siguen visibles y consumiendo cuota, admiten reintento y disponen de un proceso de reconciliación. | Aplicar SQL; programar el reconciliador cuando se necesite automatización. |
| CB-07 | Validación de tipos, longitud e identificadores completos. Errores inesperados de autenticación y archivos se envían al manejador central; no se devuelven directamente detalles del proveedor. | Código. |
| CB-08 | Una política compartida define 8–128 caracteres, mayúscula, minúscula, número y símbolo. Registro, recuperación y ajustes utilizan la misma regla. | Alinear la política configurada en Supabase Auth si existe una regla adicional. |
| CB-09 | Se comprueban errores y catálogos de registro; nunca se reasigna una identidad por coincidencia de correo. Un login válido puede completar su propio perfil interrumpido usando los metadatos del registro. Los fallos parciales no producen éxito falso. | Los perfiles históricos sin datos de registro necesitan revisión individual. |
| CB-10 | Listados de archivos y carpetas recorren todas las páginas del servidor. Conversaciones cargan mensajes recientes y ofrecen mensajes anteriores. La consulta de destinos devuelve el árbol del usuario en una operación. | Código. |
| CB-11 | Cierre local garantizado aunque falle la red o el JSON, conservando la protección frente a un cambio de cuenta durante la espera. | Código. |
| CB-12 | Preferencias aplicadas mediante trigger a los productores de notificaciones. La interfaz describe los avisos que realmente existen; la opción de actividad corresponde a pagos aprobados. Los avisos anteriores se conservan. | Aplicar SQL. |
| CB-13 | Comandos completos de pruebas; fixtures actualizados sin recurrir a credenciales reales; navegador aislado gestionado automáticamente. El auxiliar de login se retiró del descubrimiento de pruebas y dejó de imprimir tokens. | Instalar Chromium de Playwright para las pruebas visuales. |
| CB-14 | Se actualizaron dependencias afectadas. Se retiró nodemon y se utiliza el observador de Node. Se actualizó minimatch mediante una resolución explícita compatible con las comprobaciones ejecutadas. | Ejecutar `npm ci` en ambos proyectos. |
| CB-15 | La inserción de respuestas bloquea el ticket, rechaza tickets cerrados y actualiza su fecha dentro de la transacción. | Aplicar SQL. |
| CB-16 | Alertas con foco inicial, recorrido de teclado y restauración del foco. Se mantiene la base accesible de los formularios compartidos. | Revisión adicional con lector de pantalla en el entorno final. |
| CB-17 | Plantillas de variables completas, validación al iniciar, CORS configurable, cabeceras de seguridad, cierre ordenado, README e integración continua. | Configurar variables y despliegue. |
| CB-18 | Carga diferida de páginas y eliminación de consultas por carpeta para construir destinos. Un límite de error ofrece recuperación cuando falla la carga de una página. | Servir la compilación con fallback a `index.html`. |
| CB-19 | Se retiró el contexto de autenticación alternativo sin uso y su importación inexistente. Las operaciones de Auth utilizan clientes aislados. Se centralizaron reglas de entrada y pertenencia de avatares. | Código. |
| CB-20 | Actualizaciones parciales de metadatos: avatar no vuelve a enviar preferencias antiguas ni preferencias vuelven a enviar el avatar anterior. | Código y semántica de actualización de Supabase Auth. |

Supabase Auth combina las claves de metadatos enviadas sin reemplazar las claves omitidas. Por eso las actualizaciones envían únicamente la propiedad modificada. Referencia: [implementación de UpdateUserMetaData](https://github.com/supabase/auth/blob/master/internal/models/user.go).

## Validación

| Comprobación | Resultado |
| --- | --- |
| Backend | Revalidación del 4 de noviembre: 128 unidades de servicios, controladores y rutas, más 10 de PostgreSQL; las 138 aprueban sin fallos. |
| Frontend | Las 12 pruebas de sesión y aislamiento de preferencias aprueban. |
| Navegador | Recorrido aprobado de 23 rutas con 396 solicitudes a una API simulada. |
| ESLint | Sin errores. |
| Compilación | Aprobada. JavaScript inicial de 263.96 kB, frente a 612.58 kB de la auditoría: reducción aproximada del 57 %. |
| Sintaxis del backend | 91 archivos revisados sin errores de sintaxis. |
| Dependencias | npm no reportó vulnerabilidades en frontend ni backend en la consulta final. |

Los registros de trabajo están en `tmp/fix-problems-*.log` y no contienen credenciales reales de pruebas. La ejecución de SQL se separó de las demás pruebas y utiliza compilación WebAssembly de menor consumo para evitar el pico de memoria observado en este equipo.

Las pruebas de SQL utilizan PGlite, un PostgreSQL embebido, con esquemas temporales derivados de las 29 tablas proporcionadas. Cubren instalación sobre el esquema actual, actualización de tablas anteriores en inglés, conservación de registros, detección de nombres en conflicto, límites de cuota, solicitudes simultáneas en esa instancia, permanencia de bytes pendientes, fallo sin Free, ciclos y restauración de carpetas, atomicidad del primer mensaje, rechazo de respuestas a tickets cerrados y preferencias de notificación. No equivalen a una prueba de carga de varias conexiones contra Supabase remoto.

Las pruebas visuales compilan la aplicación y usan un navegador con perfil temporal propio y una API simulada. Comprueban navegación, formularios, pagos simulados, administración, exportaciones, aislamiento de preferencias y tamaños de pantalla. No ejecutan operaciones sobre cuentas reales.

## Instalación del cambio

1. Respaldar el proyecto de destino y comprobar que corresponde a la configuración del despliegue.
2. Revisar y ejecutar `supabase/migrations/20261103000000_fix_audit_consistency.sql` en ese proyecto. El archivo se ejecuta dentro de una transacción. Requiere el modelo final y las tablas comerciales existentes.
3. Ejecutar el comprobador de instalación desde la raíz:

```powershell
node --env-file=backend/.env backend/scripts/check-integrations.js
```

4. Instalar dependencias con `npm --prefix backend ci` y `npm --prefix frontend ci`.
5. Configurar `CORS_ORIGINS`, redirecciones de correo y el proxy; publicar backend y la compilación de frontend de esta misma rama.
6. Ejecutar una validación integrada con dos clientes y un administrador de prueba. Comprobar carga, descarga, compartidos, cuota, papelera, pago simulado y soporte.

La nueva columna no supone que los objetos antiguos marcados como eliminados fueron borrados físicamente. Se consideran pendientes hasta confirmarlo. Algunos archivos históricos pueden reaparecer como pendientes y volver a contabilizarse hasta completar la reconciliación; es un comportamiento deliberado para no dar por borrado un objeto desconocido.

El modelo incorpora `archivo.storage_deleted_at` y la tabla privada `limpieza_almacenamiento`. Actualizar el diccionario de datos de la entrega final con esas estructuras. La cola de limpieza verifica que un objeto no esté referenciado por un archivo antes de eliminarlo, para conservar escrituras cuyo resultado pudo perderse por un fallo de comunicación.

Inspeccionar pendientes desde `backend` con `node scripts/reconcile-storage-deletions.js`. Procesarlos explícitamente con `node scripts/reconcile-storage-deletions.js --apply`. El proceso vuelve a intentar únicamente eliminaciones previamente marcadas y objetos registrados en la cola de limpieza; no selecciona archivos activos. Sus totales no imprimen nombres de archivos ni tokens.

## Límites de esta entrega

No se publicaron cambios ni se realizaron pagos, cargas o eliminaciones sobre cuentas reales. La integración continua se dejó configurada en la rama; sus resultados remotos solo existirán cuando se suba la rama al repositorio.

El historial de sesiones reconstruido desde auditoría sigue siendo un historial de accesos recientes, no un inventario completo del proveedor. La expiración y revocación deben comprobarse también en el entorno publicado. La revisión manual con tecnologías de asistencia y la prueba de concurrencia con varias conexiones siguen formando parte de la validación de despliegue.
