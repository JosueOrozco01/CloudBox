# Revisión visual y estado funcional de CloudBox

Fecha: 4 de noviembre de 2026.
Rama: `fix-problems`.

## Resultado

Se corrigieron las inconsistencias encontradas en la revisión de las vistas de cliente y administrador, conservando la navegación, la estructura de las pantallas, los componentes, las tipografías y la identidad visual existentes. La revisión comprendió modo claro, modo oscuro y anchuras de 320, 390 y 1440 píxeles.

No se identificó un nuevo fallo bloqueante en los flujos automatizados revisados. La validación completa de operaciones con cuentas reales de Supabase continúa pendiente. También quedan 22 elementos registrados para reconciliación del almacenamiento, que se inspeccionaron sin procesarlos.

## Almacenamiento proporcional y visible

El porcentaje se calcula a partir de los bytes usados y la capacidad real. Los porcentajes redondeados que entrega la API se utilizan únicamente cuando no están disponibles ambos valores. Por ejemplo, 89 KB sobre una capacidad de 1 GB equivalen aproximadamente al 0.00849 %; el indicador conserva ese valor, sin sustituirlo por un porcentaje ficticio.

- Un consumo positivo muy pequeño tiene una marca mínima de dos píxeles en las barras lineales. El ancho restante sigue la proporción calculada.
- El medidor circular de planes tiene una señal mínima de dos grados para consumos positivos muy pequeños.
- La etiqueta muestra `<0.1 %` para valores positivos inferiores al 0.1 %. Los valores accesibles conservan el porcentaje real y los bytes usados.
- Con cero bytes, la barra queda completamente vacía y la etiqueta indica `0 %`.
- Al llegar al límite, la barra se llena. Sobre cuota, el ancho se limita al tamaño del contenedor y el texto conserva el consumo real.
- Las cantidades pequeñas se muestran en B, KB o MB según corresponda. Se corrigieron los resúmenes que mostraban `0.00 GB` o `0.00 MB` pese a contener archivos.

Estos criterios se aplican en inicio, biblioteca de archivos, perfil, planes, subida de archivos, panel administrativo, usuarios y administración de almacenamiento. El formato de las métricas de cuota es independiente de la preferencia de unidades de las listas de archivos.

El componente común `StorageBar` y las funciones de `storageUsage.js` centralizan este comportamiento. Se retiró además el valor de ejemplo de 18 GB usados sobre 50 GB del diálogo de subida.

## Inconsistencias corregidas

| Área | Corrección |
| --- | --- |
| Buscador del administrador | Superficie, texto, borde y foco coherentes en modo oscuro; se eliminó el contenedor blanco alrededor del campo oscuro. |
| Filtros de usuarios | La flecha del selector aparece una sola vez, alineada a la derecha. Se corrigió la repetición del icono causada por el cambio de fondo en modo oscuro. |
| Inicio | Buscador y acceso a ampliación de espacio adaptados al tema oscuro. El icono de búsqueda permanece junto al campo al cambiar a una disposición móvil. |
| Tarjetas de inicio | Los tres botones de opciones abren las secciones correspondientes de archivos o plan. Tienen nombres accesibles específicos. |
| Accesos rápidos | Tipografía heredada de la página y estados de interacción visibles en ambos temas. |
| Barras de uso | Unidades, cálculo, accesibilidad, señal mínima y contraste del fondo consistentes. |
| Diálogo de subida | Superficie, zona de arrastre, textos, controles, progreso, estados y errores adaptados al modo oscuro. |
| Cierre de subida | El icono sin acción de favoritos se sustituyó por un cierre funcional. El diálogo recibe el foco, permite recorrer sus controles con teclado y cerrarse con Escape cuando no hay una subida activa. |
| Perfil | Selector de foto integrado en los controles existentes, con botón “Cambiar foto”, formatos y límite visibles. |
| Etiquetas de estado | Colores semánticos adaptados a ambos temas y mayor contraste en modo claro. |
| Alertas | Mejor contraste del texto de los botones de confirmación y estados de información, éxito, advertencia y error en modo oscuro. |
| Gráfico de planes | La tercera serie mantiene visibilidad en modo oscuro. |
| Soporte | Columnas legibles mediante desplazamiento dentro de la tabla en pantallas pequeñas, sin ensanchar la página. |
| Diálogos y paginación | Ajustes de distribución para títulos largos, campos, botones y navegación a anchuras pequeñas. |

## Verificación realizada

| Comprobación | Resultado |
| --- | --- |
| Pruebas del frontend | 15 correctas, 0 fallos. Incluyen 89 KB sobre 1 GB, uso vacío, uso al 50 %, sobre cuota y valores no disponibles. |
| ESLint | Sin errores. |
| Compilación de producción | Correcta mediante Vite. |
| Recorrido funcional de navegador | 23 rutas, 397 solicitudes a una API simulada; aprobado. Incluye sesiones, preferencias por cuenta, archivos, compartidos, pagos simulados, planes, notificaciones y administración. |
| Matriz visual principal | 20 vistas y 3 diálogos, en 2 temas y 3 anchuras: 138 configuraciones sin desbordamientos, errores de carga ni excepciones de ejecución. |
| Estados adicionales | Geometría de las barras comprobada con consumo cero, al 50 %, al 100 % y al 125 %. Revisión adicional del desglose de almacenamiento por tipo de archivo. |
| Supabase: instalación | Disponibles las tablas de soporte y notificaciones administrativas, la columna de borrado confirmado, la función de soporte y el bucket de avatares. También se leyó la cola de limpieza. |
| Supabase: consultas administrativas | Listado paginado, detalle individual, filtros y reporte completo de almacenamiento correctos. |
| Limpieza de almacenamiento | Inspección sin `--apply`: 22 pendientes, 0 procesados y 0 fallos de procesamiento. |

Las capturas y los resultados de la inspección visual se guardaron localmente en `output/design-review/`. Los registros de ejecución están en `tmp/design-*.log`. Las pruebas de navegador usan datos ficticios y un navegador aislado; las consultas a Supabase de esta etapa fueron de lectura.

La validación previa del backend, detallada en `docs/FIX_PROBLEMS_2026-11-03.md`, registró 128 pruebas de servicios, controladores y rutas, más 10 de PostgreSQL, todas correctas. Las 138 pruebas se repitieron correctamente en la revisión adicional descrita a continuación. Esta etapa no modificó el backend ni las migraciones y no requiere nuevo SQL.

## Revisión adicional de controles y preferencias por cuenta

Se atendió la captura donde las etiquetas de “Crear carpeta”, “Subir archivo” y “Papelera” quedaban pegadas al borde de los botones. El problema procedía de anchuras fijas que no dejaban espacio suficiente para el texto y el icono. Los controles ahora ajustan su anchura al contenido, conservan su espacio interior y pasan a otra fila cuando es necesario. También se eliminaron restricciones equivalentes en las pestañas de archivos y en las acciones de papelera, permitiendo que su altura crezca con el texto.

El formato del espacio disponible también considera los límites de redondeo entre unidades. Por ejemplo, una capacidad disponible de 1 GB menos 914 B se presenta como 1 GB, en lugar de 1,024 MB. El cálculo de uso y la proporción del indicador siguen basándose en los bytes originales.

La preferencia de tema corresponde a toda la cuenta: se guarda en los metadatos del usuario autenticado y se conserva localmente con una clave que incluye su identificador. No modifica una configuración general del sitio. Las comprobaciones existentes cubren cuentas con preferencias distintas, cierre de sesión, respuestas tardías de una cuenta anterior, caché inválida y cambios de cuenta entre pestañas. Se aclaró el texto de la pantalla de preferencias para indicar que la elección se aplica a todas las pantallas de esa cuenta y no cambia el tema de otras cuentas.

| Comprobación adicional | Resultado |
| --- | --- |
| Pruebas del frontend | 16 correctas, 0 fallos; incluyen aislamiento de preferencias y redondeo entre unidades. |
| Pruebas del backend | 128 pruebas de servicios, controladores y rutas y 10 de PostgreSQL; 138 correctas, 0 fallos. |
| Navegación y preferencias | 23 rutas y 481 solicitudes a una API simulada; aprobado. Incluye navegación por Inicio, Mis Archivos, Compartidos, Mi Plan, Pagos y Soporte con una cuenta en modo oscuro y otra en modo claro, además de recarga y cambio de sesión. |
| ESLint y compilación | Sin errores; compilación de producción correcta mediante el ejecutor de pruebas de navegador. |
| Controles con texto ampliado | 13 vistas, 2 temas, 5 anchuras (320, 390, 667, 1024 y 1440 píxeles) y 3 tamaños de fuente base (16, 20 y 24 píxeles): 390 configuraciones sin recortes en los controles inspeccionados, desbordamientos de página ni excepciones de ejecución. |
| Supabase, solo lectura | Comprobación de instalación y consultas administrativas correctas. La inspección de limpieza volvió a informar 22 pendientes, 0 procesados y 0 fallos. |

La revisión de controles comprueba los límites interiores del botón y no solamente el ancho total de la página. Se incorporó esta comprobación al recorrido de navegador de archivos y papelera. Las evidencias adicionales se guardaron localmente en `output/button-review/after/`; los registros de esta etapa están en `tmp/button-*.log`.

## Pendientes del funcionamiento general

1. Completar una prueba integrada con dos clientes y un administrador sobre Supabase: autenticación y recuperación de acceso; carga, descarga, movimiento y papelera; compartir y revocar; pagos simulados y actualización de cuota; creación, respuesta y cierre de soporte; persistencia de las lecturas administrativas. La disponibilidad de tablas y las pruebas con datos simulados no sustituyen esta comprobación.
2. Revisar los 22 elementos pendientes de reconciliación del almacenamiento. No se ejecutó su procesamiento ni se borraron objetos de Storage durante esta revisión.
3. Vigilar una respuesta aislada `PGRST303` observada al consultar `archivo`. La repetición directa y la comprobación completa posterior terminaron correctamente con la misma configuración. No se identificó una causa reproducible ni se cambiaron credenciales. Ese código corresponde a validación o análisis de las declaraciones del JWT, según la [documentación de PostgREST](https://docs.postgrest.org/en/v14/references/errors.html). Si vuelve a aparecer, requiere diagnóstico antes de atribuirlo a la aplicación.

Estos pendientes se distinguen de las correcciones visuales, que quedaron verificadas en los escenarios descritos. Las pruebas locales de PostgreSQL continúan siendo temporales con PGlite; no se creó ningún contenedor local.
