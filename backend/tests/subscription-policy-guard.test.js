const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261025030000_subscription_policy_v2.sql'),'utf8');
test('politica 06: guarda programaciones contra /subscribe y /renew', () => {
  assert.match(sql,/NEW\.id_estado IN\s*\([\s\S]*?'Cancelada', 'Renovada'/);
  assert.match(sql,/sc\.id_suscripcion_origen = OLD\.id AND sc\.estado = 'pending'/);
});
test('el worker aplica la programacion antes de cambiar estado', () => {
  const begin = sql.indexOf('CREATE OR REPLACE FUNCTION public.cloudbox_subscription_expire_v1');
  const chunk = sql.slice(begin);
  const schedule = chunk.indexOf("SET estado = 'applied'");
  const cancel = chunk.indexOf('UPDATE public.suscripcion SET id_estado = v_canceled');
  assert.ok(schedule > 0 && cancel > schedule);
});
test('no programa tareas globales ni da acceso anon/auth', () => {
  assert.doesNotMatch(sql,/cron\.schedule\s*\(/i);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.cloudbox_subscription_change_v1/);
  assert.match(sql,/ROLLBACK|COMMIT;/);
});
