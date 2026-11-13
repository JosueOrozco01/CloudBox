# CloudBox — Cierre técnico de Fase 7 (ámbito Jennifer)

**Rama:** `feature/subscriptions-payments`. **Base estable confirmada por el usuario:** commit `f2ae255` (entregas 04 y 05); 30 pruebas Node aprobadas.

## Entregado y probado

- Pagos simulados con referencias únicas y manejo de rechazo.
- Comprobantes PDF y consulta controlada.
- Alta con plan Free, contratación pagada, renovación, historial y cuotas por plan (integración de cuotas bajo responsabilidad de Benja).
- Ciclo de vida y formato de fechas/estados en entregas 04/05.
- Política 06: upgrade inmediato con crédito proporcional por vigencia no consumida, incluso si llenó los GB; downgrade prepagado programado; cancelación programada al término. Pago cero genera asiento de crédito, no pago ficticio.
- SQL 06 superó ejecución BEGIN/ROLLBACK; prueba funcional integrada BEGIN/ROLLBACK informada como exitosa; pruebas estructurales Node aprobadas.

## Corrección de seguridad del cierre

La función `cloudbox_subscription_prevent_renew_with_schedule` protege **Cancelada y Renovada** sobre la suscripción origen mientras exista programación `pending`, para impedir que `/subscribe` eluda una operación pactada. Al aplicar una programación, el worker cambia su estado a `applied` **dentro de la misma transacción, antes de cancelar la suscripción**. La transacción PostgreSQL deshace ambos cambios si ocurre un error. No se sustituye el cuerpo de checkout de Benja ni la rama develop.

## Pendientes / límites que impiden declarar 100% validada la política 06

1. **Probar sobre base aislada PostgreSQL** que el guard bloquea `/subscribe` tras cancelación y downgrade; repetir con 2 sesiones concurrentes. Las pruebas Node de este paquete son estáticas, no prueban concurrencia real.
2. **Prueba aislada del worker** de vencimientos `cloudbox_subscription_expire_v1()` con cancelación, downgrade en término, downgrade ejecutado tarde y corrida repetida. **Nunca lanzar globalmente en la base compartida sin esta prueba.** No se configura cron automático aquí.
3. Confirmar con Benja que la cuota considera `PorVencer`, valida fechas, y bloquea escrituras cuando el uso rebasa cuota tras downgrade/Free sin borrar archivos.
4. Revisar contratos de frontend: `scheduled`, `effectiveOn`, `creditGenerated`, `creditApplied`, `remainingCredit`, `amountDue`; comprobar que la ruta `/subscribe` no esquiva la política de upgrades proporcionalmente acreditados.
5. Validar uso de `SECURITY DEFINER`, políticas de servicio, errores `CLOUDBOX_PENDING_ACTION_EXISTS` como HTTP 409, auditoría e idempotencia antes de producción.

## Decisiones comerciales

- 5 GB del Básico llenos **no consume el tiempo**: con 15 días restantes, crédito Q4.50 contra Q25 Pro, importe a pagar Q20.50.
- Los períodos renovados acumulados forman parte del crédito por tiempo no consumido.
- El downgrade se paga una sola vez al programarse; se activa al vencimiento; no hay cargo automático futuro.
- Cancelación conserva servicios pagados hasta el final.
- Free usa vencimiento técnico largo (`vigencia_dias=36500`), presentado sin fecha comercial de expiración.

## Flujo final Git

1. Instalar paquete local solo sobre `feature/subscriptions-payments`.
2. Ejecutar todas las pruebas Node y `git diff --check`.
3. Probar SQL **en entorno aislado**; luego aplicar de forma permanente cuando el usuario lo autorice.
4. Agregar explícitamente `supabase/migrations/20261025030000_subscription_policy_v2.sql`, `backend/tests/subscription-policy-v2.test.js`, `backend/tests/subscription-policy-guard.test.js`, `docs/SUSCRIPCIONES_DECISIONES_TECNICAS.md`, `docs/FASE7_JENNI_CIERRE.md`.
5. No usar `git add .` o `git add -A`; excluir respaldos locales no versionados.
6. Tras validación y aprobación, commit y push únicamente a `feature/subscriptions-payments`.
