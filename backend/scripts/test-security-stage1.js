'use strict';
// Solo Docker local aislado. No carga .env ni acepta una URL de base remota.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const container = 'cloudbox-security-stage1';
const db = 'security_' + Date.now();
const root = path.resolve(__dirname, '../..');
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
const info = JSON.parse(docker(['inspect', container]))[0];
assert.equal(info.Config.Image, 'postgres:17');
assert.equal(info.Config.Labels?.['cloudbox.task'], 'security-stage1');
assert.equal(info.HostConfig.NetworkMode, 'none');
assert.ok(!info.HostConfig.Binds?.length);
assert.ok(info.Mounts.every(m => m.Type === 'volume' && /^[a-f0-9]{64}$/.test(m.Name) && m.Destination === '/var/lib/postgresql/data'));
const sql = (input, database = db) => execFileSync('docker', ['exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq'], { input, encoding:'utf8', stdio:['pipe','pipe','pipe'] }).trim();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const apply = read('supabase/manual/security/20261027_etapa1.sql');
const inspect = read('supabase/manual/security/20261027_inspeccion.sql');
const asUser = "SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; ";
let checks = 0;
function equal(query, expected) { assert.equal(sql(query), expected); checks++; }
function denied(query, pattern = /permission denied/) {
  assert.throws(() => sql(query), error => pattern.test(String(error.stderr))); checks++;
}
try {
  sql(`CREATE DATABASE ${db};`, 'postgres');
  // Roles son globales del contenedor exclusivo. Eliminar solo los creados por esta prueba al terminar.
  sql(read('backend/tests/sql/security-schema.sql'));
  const structure = () => sql(`SELECT jsonb_build_object(
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p),
    'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE connamespace='public'::regnamespace),
    'functions',(SELECT jsonb_agg(pg_get_functiondef(oid) ORDER BY oid) FROM pg_proc WHERE pronamespace='auth'::regnamespace),
    'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t),
    'rls',(SELECT jsonb_agg(jsonb_build_array(oid,relowner,relrowsecurity,relforcerowsecurity) ORDER BY oid) FROM pg_class WHERE relnamespace='public'::regnamespace));`);
  const beforeStructure = structure();
  const beforeRows = sql('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public."LogAuditoria" t;');
  const before = JSON.parse(sql(inspect));
  assert.equal(before.effective.find(r => r.role === 'authenticated').role_update, true);
  // Probar tambien concesiones independientes por columna y PUBLIC, ausentes de la exportacion inicial.
  sql('GRANT SELECT(detalle), INSERT(accion) ON public."LogAuditoria" TO PUBLIC; GRANT UPDATE(id_rol) ON public.usuario TO authenticated; GRANT UPDATE(nombre) ON public.estado_carpeta TO PUBLIC;');
  sql(apply);
  const appliedSnapshot = sql(inspect);
  sql(apply);
  equal(inspect, appliedSnapshot);
  assert.equal(structure(), beforeStructure); checks++;
  equal('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public."LogAuditoria" t;', beforeRows);
  for (const role of ['anon','authenticated']) {
    for (const command of ['SELECT *','SELECT detalle','DELETE','UPDATE']) {
      const query = command === 'DELETE' ? 'DELETE FROM public."LogAuditoria"' : command === 'UPDATE' ? "UPDATE public.\"LogAuditoria\" SET detalle='alterado'" : command+' FROM public."LogAuditoria"';
      denied(`SET ROLE ${role}; ${query};`);
    }
    denied(`SET ROLE ${role}; INSERT INTO public."LogAuditoria"(accion) VALUES('FALSO');`);
    denied(`SET ROLE ${role}; SELECT nextval(pg_get_serial_sequence('public."LogAuditoria"','id'));`);
    for (const column of ['id_rol','id_estado','correo','auth_user_id','espacio_usado_by']) {
      denied(`SET ROLE ${role}; UPDATE public.usuario SET ${column}=${column} WHERE id=1;`);
    }
    denied(`SET ROLE ${role}; UPDATE public.estado_carpeta SET nombre='falso' WHERE id=1;`);
    denied(`SET ROLE ${role}; INSERT INTO public.estado_carpeta(nombre) VALUES('falso');`);
    denied(`SET ROLE ${role}; DELETE FROM public.estado_carpeta WHERE id=1;`);
    denied(`SET ROLE ${role}; TRUNCATE public.estado_carpeta;`);
    equal(`SET ROLE ${role}; SELECT count(*) FROM public.estado_carpeta;`, '2');
  }
  denied('SET ROLE anon; UPDATE public.usuario SET nombre=nombre WHERE id=1;');
  equal(asUser+"UPDATE public.usuario SET nombre='Propio',apellido='Nuevo' WHERE id=1 RETURNING nombre;",'Propio');
  denied(asUser+"UPDATE public.usuario SET nombre='Bloqueado',id_rol=2 WHERE id=1;");
  equal('SELECT nombre FROM public.usuario WHERE id=1;', 'Propio');
  equal(asUser+"UPDATE public.usuario SET nombre='Ajeno' WHERE id=2 RETURNING nombre;",'');
  equal('SELECT nombre FROM public.usuario WHERE id=2;', 'Dos');
  equal(asUser+'SELECT count(*) FROM public.usuario;', '1');
  // Dashboard/SQL Editor (postgres) y backend (service_role) conservan sus operaciones.
  for (const role of ['postgres','service_role']) {
    equal(`SET ROLE ${role}; UPDATE public.usuario SET id_rol=2,id_estado=2 WHERE id=2 RETURNING id_rol||':'||id_estado;`, '2:2');
    equal(`SET ROLE ${role}; INSERT INTO public."LogAuditoria"(id_usuario,accion,detalle) VALUES(1,'LEGITIMO','backend') RETURNING accion;`, 'LEGITIMO');
    equal(`SET ROLE ${role}; UPDATE public.estado_carpeta SET descripcion='legitimo' WHERE id=1 RETURNING descripcion;`, 'legitimo');
    assert.ok(Number(sql(`SET ROLE ${role}; SELECT count(*) FROM public."LogAuditoria";`)) > 0); checks++;
  }
  // Una concesion heredada desconocida debe cancelar atomica y totalmente el SQL.
  sql('CREATE ROLE unexpected_reader NOLOGIN; GRANT SELECT ON public."LogAuditoria" TO unexpected_reader; GRANT unexpected_reader TO authenticated;');
  const driftBefore = sql(inspect);
  denied(apply, /heredad/);
  equal(inspect, driftBefore);
  sql('REVOKE unexpected_reader FROM authenticated; DROP OWNED BY unexpected_reader; DROP ROLE unexpected_reader;');
  // Politica distinta: abortar sin reemplazarla a ciegas.
  sql('ALTER POLICY "Users can update own profile" ON public.usuario USING(true);');
  denied(apply, /Politicas UPDATE/);
  console.log(`PASS security stage1: ${checks} comprobaciones PostgreSQL locales; ACL, RLS, propiedad, administracion, idempotencia y rollback por deriva.`);
} finally {
  sql(`DROP DATABASE IF EXISTS ${db} WITH (FORCE);`, 'postgres');
  sql('DROP ROLE IF EXISTS unexpected_reader,anon,authenticated,service_role;', 'postgres');
}
