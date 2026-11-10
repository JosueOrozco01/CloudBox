# Mejoras de experiencia de CloudBox

El botón «Guía de esta pestaña» está disponible en las rutas públicas, de cliente y de administración. Las pestañas de Perfil, Seguridad, Preferencias y Mis favoritos tienen instrucciones propias. La guía se cierra al cambiar de ruta y permite navegación por teclado, Escape y devolución del foco al botón.

## Archivos

«Abrir» muestra un visor dentro de CloudBox, tanto en Mis archivos como en Compartidos. «Descargar» guarda el original con su nombre. Ambas acciones conservan los controles de acceso existentes; las bibliotecas de Word y hojas de cálculo se cargan al abrir el formato correspondiente.

| Formato | Vista previa |
| --- | --- |
| PDF | Visor PDF del navegador, si está disponible |
| JPG, PNG, GIF, WebP, AVIF, BMP, ICO, SVG | Imagen ajustada a la pantalla |
| MP4, WebM, OGV, MOV, M4V | Reproductor de video; depende del códec del navegador |
| MP3, WAV, OGG, M4A, AAC, FLAC, Opus | Reproductor de audio; depende del códec del navegador |
| TXT, Markdown, CSV, JSON, XML, HTML y código | Texto sin ejecutar scripts; hasta 2 MB |
| DOCX | Documento Word renderizado localmente; hasta 20 MB |
| XLSX, XLS, ODS | Datos por hoja; hasta 20 MB, 500 filas y 100 columnas por hoja |
| Otros, incluidos DOC, PPT/PPTX y ZIP | Explicación y descarga para abrir con una aplicación compatible |

La vista de hojas de cálculo permite cambiar de hoja. Para fórmulas, gráficos y fidelidad completa de Office se conserva la descarga del original. Los enlaces firmados mantienen su vencimiento de 60 segundos; si el navegador requiere nuevas solicitudes tras vencer el enlace, se debe cerrar y volver a abrir el archivo.

## Adaptación y carga

Se corrigieron las cuadrículas y acciones de la portada, pestañas del explorador, paneles laterales de Actividad y Soporte, controles compartidos y barra administrativa para pantallas pequeñas. Las tablas anchas conservan desplazamiento dentro de su contenedor.

Las páginas se cargan por ruta y las consultas de perfil y preferencias se ejecutan en paralelo. Las ubicaciones de carpetas usan `GET /api/folders/locations`, con autenticación y filtros por propietario y estado activo. La consulta trae bloques de 1000 registros y arma las rutas en memoria; reemplaza una petición HTTP por cada carpeta. Se deben actualizar frontend y backend juntos; no requiere migración de base de datos.

La compilación previa producía un archivo principal de JavaScript de 612.82 kB y CSS de 286.06 kB. La primera compilación con carga por ruta produjo 268.57 kB de JavaScript y 41.73 kB de CSS principales. Son tamaños de archivos sin comprimir, no mediciones del tiempo de respuesta del servidor ni del tiempo total de navegación.

## Validación

- `npm run lint`, `npm test` y `npm run build` en frontend.
- `node --test backend/tests/folder-locations.test.js backend/tests/security-folders.test.js`.
- Edge sin interfaz, con datos API simulados: anchos de 320, 375, 768 y 1440 px en páginas públicas y de cliente; comprobaciones adicionales de administración en 320 y 768 px.
- Vista previa real de JSON, DOCX y XLSX, cambio de hoja, HTML mostrado sin ejecutar scripts, descarga con nombre original y cierre por Escape.
- La integración con Supabase y archivos reales de usuarios no se verificó con una sesión real.

## Segunda optimización de tiempos de espera

- El perfil verificado se reutiliza en memoria durante 30 segundos. Las preferencias se cargan sin bloquear la página y el inicio obtiene su resumen directamente, sin esperarlo dentro del contenedor de autenticación.
- Las lecturas JSON idénticas comparten la petición en curso y conservan el resultado durante 5 segundos; perfil y preferencias, 30 segundos. La caché separa credenciales, tiene un máximo de 80 entradas y se invalida al modificar datos, cambiar de sesión, renovar el token o actualizar manualmente un recurso. Las bandejas y auditorías solo comparten peticiones simultáneas, sin conservar respuestas para posteriores consultas. Las URLs de archivos siempre solicitan autorización nueva.
- Mis archivos muestra la lista sin esperar estadísticas ni ubicaciones de carpetas. Compartidos consulta favoritos en paralelo y Planes consulta catálogo, suscripción y métodos de pago en paralelo.
- Señalar o enfocar un enlace adelanta la descarga del código de esa página. Señalar un archivo prepara el visor y su biblioteca; al hacer clic, la autorización se solicita al mismo tiempo que carga el visor. No se descargan archivos ni se registran aperturas por señalar un elemento.
- Al reabrir texto o documentos Office se pueden reutilizar sus bytes durante 30 segundos, después de autorizar otra vez y comparar la versión y tamaño devueltos por el servidor. El límite total es de 20 MB y 8 archivos en memoria. Los cambios de datos y sesión vacían esta caché. Audio, video, PDF e imágenes siguen usando la carga directa del navegador.
- El backend consulta rol y estado de usuario en paralelo, manteniendo la validación del token, usuario activo y el cliente sujeto a RLS en cada petición.

Una prueba en Edge con respuestas simuladas de 150–1800 ms mostró la lista antes de finalizar preferencias, estadísticas y ubicaciones; hubo una sola consulta de perfil, preferencias y archivos al ir y volver entre secciones. En esa ejecución, volver a Mis archivos tomó unos 91 ms; la primera vista de texto tomó 680 ms y reabrirla 254 ms, con dos autorizaciones y una sola descarga del contenido. Son mediciones locales con latencia artificial, no garantías de tiempos con Supabase o archivos reales.

Validación adicional: 15 pruebas de frontend, pruebas de autenticación paralela, carpetas y acceso a recursos compartidos. La suite antigua `backend/tests/security-stage1.test.js` no completó dos casos: uno intenta crear un cliente sin `SUPABASE_URL` y otro usa un mock de administración sin `getUsersList`. Los casos específicos de autenticación y permisos usados para este cambio sí pasan.

## Carga uniforme y recorrido visual

Las cargas principales de Compartidos y de las páginas que usan `ModulePage` utilizan la misma pantalla de carga que Inicio, Mis archivos y la validación de cuenta. El indicador común muestra la nube de CloudBox, una órbita y una línea de actividad; los indicadores parciales y de diálogos usan su variante compacta. Las animaciones respetan la preferencia de movimiento reducido y no introducen esperas artificiales.

El contenedor autenticado reserva al menos la altura disponible de la ventana y empuja el footer hacia abajo cuando hay poco contenido. Al preparar un visor de archivos, su carga se presenta como una capa sin insertar bloques que desplacen el contenido.

La guía ahora es un recorrido con Anterior, Siguiente, Omitir y Finalizar. Cada paso señala controles reales, mantiene esa región visible y desenfoca el resto de la página. La tarjeta adapta su posición al espacio disponible, muestra el progreso y admite flechas del teclado, Tab y Escape. Durante el recorrido el fondo no recibe clics ni foco; al salir se restauran el foco y la posición de desplazamiento. Si una acción aún no aparece, por ejemplo porque no hay archivos, se señala su contenedor o el encabezado de la sección.

Verificado en Edge con respuestas API simuladas, a 1280, 375 y 320 px: posición del footer durante la carga, los cuatro pasos de Compartidos, retorno al paso anterior, finalización, omisión, Escape y retención/restauración del foco. Las pruebas de geometría también cubren ventanas horizontales y regiones parcialmente fuera de pantalla.
