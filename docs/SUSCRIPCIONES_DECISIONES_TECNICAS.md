# CloudBox — Decisiones técnicas de Suscripciones, Pagos y Comprobantes

Estado documental: **política aprobada; implementación de facturación prorrateada y operaciones diferidas pendiente**. Fecha: 2026-10-25. Rama: `feature/subscriptions-payments`. Responsable del módulo: backend de Suscripciones, Pagos y Comprobantes. No modifica módulos de Benja.

## 1. Alcance y evidencia

Los flujos ya validados contra Supabase incluyen contratación pagada, pago simulado rechazado, renovación pagada, cambio inmediato al precio total, cancelación inmediata a Free, comprobantes a demanda, consultas e historial. La entrega 04 pasó 22 pruebas automatizadas y se validó con cuenta de pruebas 72. Estas pruebas **no** prueban las reglas de prorrateo y diferimiento definidas a continuación.

## 2. Decisiones de producto (política objetivo)

| Evento | Regla | Efecto en almacenamiento | Estado de implementación |
| --- | --- | --- | --- |
| Alta | Free 1 GB, sin cobro, asignación automática | 1 GB | Validado |
| Comprar plan pagado | Activación tras pago simulado aprobado; duración según `plan.vigencia_dias` | Cuota del plan | Validado |
| Pago rechazado | Conservar plan y fecha; registrar rechazo sin comprobante | Ninguno | Validado |
| Renovación | Extender vencimiento anterior por vigencia del plan, sin perder días | No cambia | Validado |
| Upgrade | Activación inmediata; acreditar período no consumido del plan origen; cobrar diferencia con 2 decimales | Aumenta de inmediato | **Pendiente** |
| Downgrade | Registrar solicitud diferida; activar nuevo plan al fin del ciclo actual; no cobrar por adelantado sin consentimiento | Disminuye al activar | **Pendiente** |
| Cancelación | Solicitud programada al fin del período pagado; al vencer pasa a Free sin pago | 1 GB al activarse | **Pendiente**; entrega 04 cancela inmediatamente |
| Vencimiento | PorVencer si restan <= 5 días; Vencida al superar fecha; reconciliación por servicio autorizado | Bloquear nuevas escrituras si vencido | Función SQL creada; job pendiente |
| Historial | Preservar fechas y eventos; `daysRemaining=0` en estados no vigentes, `null` en Free | Sin efecto | **Parche de presentación incluido** |

## 3. Fórmula propuesta de upgrade

Se usa dinero decimal, nunca float de JS para montos. `credit = round_half_up(precio_actual * dias_no_consumidos / dias_ciclo_origen, 2)`; `a_cobrar = max(0, precio_nuevo - credit)` en quetzales. Se recomienda que `dias_no_consumidos` se calcule por diferencia de fechas civiles en UTC y se limite a `[0, dias_ciclo_origen]`. **Importante:** si una renovación acumuló 60 días por dos ciclos pagados, no se puede usar el precio de un solo ciclo para acreditar los 60 días ni truncar la vigencia; hace falta un libro de períodos pagados y créditos consumidos. No implementar una simple división contra `fecha_fin` hasta contar con ese registro.

Si el crédito excede el costo nuevo: no crear pago simulado aprobado de Q0; almacenar un asiento de crédito aplicado/saldo remanente y una transición sin cobro. El saldo jamás produce reembolso automático en efectivo. Registrar monto base, crédito aplicado, total cobrado, período usado, moneda, motivo, ids anteriores/nuevos, referencia e idempotencia.

## 4. Programación de downgrades y cancelación

La solicitud diferida no debe convertir la suscripción activa a `Cancelada` antes de su fecha fin; de otro modo el índice parcial `suscripcion_usuario_vigente_unica_fase7` y el servicio de cuotas podrían dejar de reconocerla. Requiere **tabla propia de operaciones programadas** (usuario, suscripción origen, destino o Free, fecha efectiva, estado de operación, versión, referencia idempotente, timestamps, actor). Un único job autorizado ejecutará la transición con `SELECT ... FOR UPDATE`, transacción e idempotencia; comprobará que el estado y plan origen aún coincidan. Nueva solicitud reemplaza la anterior de modo auditable; upgrade inmediato invalida diferidas incompatibles.

No se debe usar `fecha_fin` de la suscripción actual para representar una cancelación futura; conserva su carácter de vencimiento. Para evitar sorpresas, la respuesta API debe incluir `effectiveDate`, `currentPlan`, `scheduledPlan`, `canUndo`.

## 5. Estados y contrato actual

`estado_suscripcion`: Pendiente 1, Activa 2, PorVencer 3, Vencida 4, Renovada 5, Cancelada 6. `estado_pago`: Aprobado 1, Rechazado 2. La solicitud programada necesita un **estado independiente**; no reutilizar `Pendiente` de suscripciones. El plan Free tiene id 8 y vigencia técnica de 36500 días que no se muestra al usuario.

Rutas actuales: `GET /api/subscriptions/current`, `GET /api/subscriptions/history`, `POST /api/subscriptions/subscribe`, `POST /api/subscriptions/renew`, `POST /api/subscriptions/change-plan` (campo `newPlanId`), `PATCH /api/subscriptions/cancel`. **Actualmente `/cancel` cancela inmediatamente**, por lo que el contrato deberá versionarse o modificarse coordinadamente con frontend antes de habilitar la política futura. Errores relevantes: 401 token, 402 pago rechazado, 409 duplicados/operación inválida. La autorización procede de `req.user.id`; nunca aceptar ids de usuario del cuerpo.

## 6. Persistencia, seguridad e idempotencia

Funciones SQL `SECURITY DEFINER` con `search_path=''`, permiso EXECUTE de `service_role` y denegación a `anon`/`authenticated`; secretos solo en servidor. Índices existentes: única suscripción Activa/PorVencer por usuario y referencia de pago única no nula. Toda transición y ajuste contable es transaccional; las funciones serializan por fila de usuario. Reintentos de la misma referencia no deben crear pagos dobles. Proteger además contra concurrencia entre renovación, upgrade y operación programada. No modificar archivos al cambiar de plan; las cuotas se recalculan y las nuevas escrituras se bloquean si `usedBytes` supera límite.

## 7. Integración y límites de responsabilidad

El módulo de Benja (`quota.service.js`) reconoce solo `Activa`; debe tratar también `PorVencer` y comprobar la vigencia por fecha; no cambiarlo unilateralmente. El job de vencimientos requiere coordinación de infraestructura. PDFs se generan a demanda y la URL temporal firmada no debe registrarse en logs públicos. Las fechas y políticas de fin de período deben considerar un único reloj de negocio y zonas horarias; evitar JavaScript Date con fechas SQL interpretadas según máquina.

## 8. Pruebas aceptadas / pendientes

**Aprobadas** (cuenta 72): renovación fallida `pago=9`, renovación aprobada `suscripcion=18,pago=10`, cambio rechazado `pago=11`, cambio inmediato Pro `suscripcion=19,pago=12`, comprobante `100003`, cancelación inmediata Free `suscripcion=20`, cuota Free 1GB y Pro 50GB, historial. **Pendientes**: prorrateo multirrenovación, upgrade con saldo ≥ precio nuevo, downgrade diferido, cancelación diferida, reversión de cancelación, job de vencimiento controlado, cuota PorVencer, concurrencia e idempotencia extremos; nuevo contrato frontend.

## 9. Registro de decisiones (ADR)

- ADR-001: pagos simulados; no tarjetas reales ni pasarelas.
- ADR-002: Free 1 GB asignado al registrar cuenta; no cobrar Free.
- ADR-003: una suscripción vigente por usuario; historial inmutable salvo estados de transición.
- ADR-004: renovar conserva los días no consumidos.
- ADR-005: upgrade inmediato con crédito contable auditado; no perder ciclos acumulados.
- ADR-006: downgrade y cancelación diferidos hasta el final de vigencia pagada.
- ADR-007: no borrar archivos al disminuir cuota; bloquear subidas fuera de capacidad.
- ADR-008: no mostrar días restantes de estados históricos ni los 36500 días técnicos de Free.
- ADR-009: migraciones revisadas por separado en SQL Editor; no ejecutar job global de vencimientos sin aprobación.
- ADR-010: cambios solo en `feature/subscriptions-payments`, sin tocar módulos Benja/develop, sin commit hasta pruebas.

## 10. Siguiente implementación requerida

Preparar migración transaccional para libro de créditos y operaciones programadas; funciones v2 e endpoints correspondientes; proceso scheduler seguro; actualizar tests de dominio y HTTP; validar con una cuenta de pruebas (no operar sobre suscripciones de otros usuarios). Dejar la migración 04 intacta hasta que las funciones v2 pasen pruebas y el contrato frontend esté confirmado. **Este archivo no certifica que esas operaciones v2 ya estén implementadas.**

---

## Anexo 06 — Política comercial v2 (25 de octubre de 2026)

**Estado:** diseño implementado en migración local, **NO validado en Supabase** hasta completar pruebas de integración. Esta sección se integra después del documento `SUSCRIPCIONES_DECISIONES_TECNICAS.md`; prevalece sobre las políticas anteriores una vez desplegada.

### Decisiones y justificación

| Código | Decisión | Motivo |
|---|---|---|
| D06-01 | Renovar conserva vigencia restante y suma `vigencia_dias`. | Evitar pérdida de períodos pagados. |
| D06-02 | Upgrade (`precio_nuevo > precio_actual`) inmediato, con crédito proporcional por **todos** los días restantes y crédito arrastrable. | Un período acumulado por renovación no debe perder su valor. |
| D06-03 | Crédito = `round(precio_plan_actual × días_restantes / vigencia_dias, 2)`; se suma el saldo anterior del libro de créditos. | Cálculo transparente y auditable; evita depender del número de renovaciones. |
| D06-04 | Crédito aplicado = `min(crédito_total, precio_nuevo)`. Pago simulado = `precio_nuevo − crédito_aplicado`; sobrante queda en `cloudbox_subscription_credit`. | Evitar importes negativos y no eliminar remanentes. |
| D06-05 | Si el crédito cubre todo el precio, **no se crea un pago de importe cero**; sí se crea nueva suscripción y un asiento de crédito auditable. | No presentar una operación interna como cobro. |
| D06-06 | Downgrade (`precio_nuevo < precio_actual`) se **precompra** mediante pago simulado al solicitarlo, crea suscripción Pendiente y se activa al vencimiento. | Evitar cobros no autorizados o desatendidos al vencer. La interfaz debe explicar que es un prepago no reembolsable en esta simulación. |
| D06-07 | Cancelación programada sin cobro; conserva el plan hasta fin de vigencia y entonces activa Free. | Proteger beneficios ya pagados. |
| D06-08 | Una única acción programada por usuario; mientras esté pendiente, bloquear otra modificación de plan o renovación. | Evitar carrera, doble facturación y períodos contradictorios. |
| D06-09 | El procesador de fechas es idempotente respecto a acciones ya aplicadas y requiere `service_role`. | Seguridad operativa y repetición de ejecuciones. |
| D06-10 | Si vence un plan pagado sin programación, el procesador lo marca Vencida y le asigna Free. | Continuidad mínima del servicio sin dar espacio de pago gratis. |
| D06-11 | Free es 1 GB y `daysRemaining=null`; cancelada, renovada y vencida muestran `daysRemaining=0`, preservando `endDate`. | Claridad del contrato para frontend. |
| D06-12 | Archivos existentes se conservan en downgrade/Free, pero el límite bloquea nuevas escrituras si está excedido. | Prevención de pérdida de datos; requiere validación con cuota de Benja. |

### Ejemplo de upgrade acumulado

Básico Q29/30 días, 60 días restantes: crédito = Q58.00. Pro Q89/30 días: pago Q31.00, saldo Q0.00. Con 120 días restantes, crédito = Q116.00: pago Q0.00 y saldo Q27.00 a favor; se genera ajuste auditable sin recibo de pago por Q0.

**Limitación comercial:** este modelo valora días mediante el precio fijo del plan original, sin descuentos históricos ni impuestos. Cualquier cambio futuro en tarifas, promociones o política de reembolso requerirá un libro de períodos comprados con precios de origen, antes de habilitar cobros reales.

### Contratos API existentes que se mantienen

- `POST /api/subscriptions/renew`: pago simulado; conserva acumulación de vigencia. Con acción pendiente responde conflicto (pendiente de verificar mapeo HTTP).
- `POST /api/subscriptions/change-plan`: `newPlanId`, `paymentMethodId`, `referenceCode`, `simulateFailure` (boolean). Upgrade exitoso devuelve `creditGenerated`, `creditApplied`, `remainingCredit`, `amountDue`, `scheduled:false`. Downgrade exitoso devuelve `scheduled:true`, `effectiveOn`, ID de suscripción futura Pendiente y pago aprobado.
- `PATCH /api/subscriptions/cancel`: devuelve `scheduled:true`, `effectiveOn`; **no** activa Free al instante.
- `GET /api/subscriptions/current`: sigue devolviendo el plan actualmente vigente.
- `GET /api/subscriptions/history`: conserva todas las suscripciones, incluidas Pendiente/Cancelada/Renovada.
- `cloudbox_subscription_expire_v1()` es RPC exclusivo de `service_role`; **no existe endpoint público** ni cron creado por este paquete.

### Persistencia añadida

- `public.cloudbox_subscription_credit`: saldo por usuario.
- `public.cloudbox_subscription_credit_event`: asientos de generación/consumo de crédito.
- `public.cloudbox_subscription_schedule`: acciones futuras de cancelación o downgrade, con `pending/applied/superseded/error`.
- Índices parciales para impedir dos acciones pendientes y para buscar vencimientos; única referencia en libro de crédito.

### Seguridad, prueba y despliegue

- La migración es **nueva**, no reescribe el archivo `20261025020000_subscription_lifecycle.sql` ya aplicado.
- Ejecutar una sola vez en Supabase SQL Editor tras revisar el contenido; usa `BEGIN/COMMIT` y `CREATE OR REPLACE FUNCTION` para mantener interfaces existentes.
- No ejecutar manualmente `cloudbox_subscription_expire_v1()` en la base compartida hasta disponer de prueba en entorno aislado y aprobación de despliegue; modifica todas las cuentas vencidas.
- Sin cron, las acciones programadas **no se ejecutarán solas**; requiere tarea autorizada que invoque la RPC al menos diariamente.
- Antes de aplicar, tomar respaldo y comprobar migraciones 02–04 y catálogo real de estados/planes.
- Ejecutar pruebas unitarias y de integración por usuario de pruebas: pago rechazado, crédito parcial, crédito total, saldo arrastrado, downgrade prepagado, cancelación programada, procesamiento al vencer, doble ejecución, idempotencia, cuota y comprobantes.
- Un rechazo de pago no debe modificar saldo de crédito ni vigencia. No crear recibos para ajustes sin pago.
- No tocar el servicio `quota.service.js` de Benja; solicitarle soportar `PorVencer` y actualización por vigencia efectiva.

### Riesgos por resolver antes de cerrar Fase 7

1. Revisión y ejecución de SQL en Supabase; falta probar **todas** las rutas contra base real.
2. Hay operaciones anteriores a esta política, como cancelaciones inmediatas y cambios sin crédito; no se migran ni recalculan retroactivamente.
3. El prepago de downgrade no admite anulación automática ni devoluciones; la interfaz debe informarlo. Posible mejora posterior: reversión administrada con auditoría.
4. Aprobación e instalación de un cron/worker protegido; no corresponde alterar infraestructura compartida por cuenta propia.
5. Confirmar `413` de cuota y estados `PorVencer` con Benja; revisión del contrato y pruebas de integración global.
6. Para periodos que superen cambios futuros de tarifas, se recomienda ledger por compra antes de pagos reales.

### Evidencia histórica y estado de validación

- Entregas 03–05: 25 pruebas automatizadas aprobadas por usuario; pagos, renovaciones y cancelación inmediata verificados con cuenta de prueba (política anterior).
- Entrega 06: migración SQL v2, anexo y pruebas de inspección **generados localmente**; aún **no implementada en Supabase, no probada en base real ni subida a GitHub**.
