'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlPath = path.resolve(__dirname, '../../supabase/migrations/20261024020000_free_subscription.sql');
const sql = fs.readFileSync(sqlPath,'utf8');
test('Free no modifica los planes de pago existentes',()=>{
  assert.match(sql,/VALUES \('Free'/);
  assert.doesNotMatch(sql,/UPDATE\s+public\.plan/i);
  assert.doesNotMatch(sql,/DELETE\s+FROM\s+public\.plan/i);
});
test('Unicidad de suscripción Activa y PorVencer',()=>{
  assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS suscripcion_usuario_vigente_unica_fase7/);
  assert.match(sql,/WHERE id_estado IN \(2,3\)/);
});
test('Alta automática en usuario sin suscripción y sin pago',()=>{
  assert.match(sql,/AFTER INSERT ON public\.usuario/);
  assert.match(sql,/NOT EXISTS \(SELECT 1 FROM public\.suscripcion WHERE id_usuario = NEW\.id\)/);
  assert.doesNotMatch(sql,/INSERT INTO public\.pago/i);
});
test('Migración permite backfill sin modificar suscripciones históricas',()=>{
  assert.match(sql,/NOT EXISTS \(SELECT 1 FROM public\.suscripcion s WHERE s\.id_usuario=u\.id\)/);
  assert.match(sql,/ON CONFLICT DO NOTHING/);
});
