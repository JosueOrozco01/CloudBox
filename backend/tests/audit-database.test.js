const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261103000000_fix_audit_consistency.sql'),'utf8');

test('audit migration enforces quota, deletion, ownership, tickets and preferences in PostgreSQL', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE public.usuario(id integer PRIMARY KEY,auth_user_id uuid);
      CREATE TABLE public."LogAuditoria"(id integer PRIMARY KEY);
      CREATE TABLE public.plan(id integer PRIMARY KEY,nombre text,precio numeric,espacio_maximo_gb numeric,id_estado integer);
      CREATE TABLE public.estado_suscripcion(id integer PRIMARY KEY,nombre text);
      CREATE TABLE public.suscripcion(id integer PRIMARY KEY,id_usuario integer,id_plan integer,id_estado integer,fecha_inicio date,fecha_fin date);
      CREATE TABLE public.archivo(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_usuario integer,nombre text,tamano_bytes bigint,id_estado integer);
      CREATE TABLE public.carpeta(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_usuario integer,nombre text,id_padre integer,id_estado integer);
      CREATE TABLE public.notificacion(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_usuario integer,tipo text);
      INSERT INTO auth.users(id) VALUES('11111111-1111-4111-8111-111111111111');
      INSERT INTO public.usuario VALUES(1,'11111111-1111-4111-8111-111111111111'),(2,NULL);
      INSERT INTO public.plan VALUES(42,'Free',0,1,1),(7,'Premium',29,5,1);
      INSERT INTO public.estado_suscripcion VALUES(2,'Activa');
    `);
    await db.exec(migration);
    await db.exec('GRANT USAGE ON SEQUENCE public.support_ticket_id_seq,public.cloudbox_storage_cleanup_id_seq TO anon;');
    await db.exec(migration); // Repeat safely after partial deployments.
    assert.equal((await db.query("SELECT has_sequence_privilege('anon','public.support_ticket_id_seq','USAGE') AS allowed")).rows[0].allowed,false);

    await t.test('capacity is serialized, counts trash and unconfirmed deletions, and fails closed without Free', async () => {
      for(let i=0;i<20;i++) await db.query("INSERT INTO public.archivo(id_usuario,nombre,tamano_bytes,id_estado) VALUES(1,$1,52428800,1)",['file-'+i]);
      const simultaneous=await Promise.allSettled(['remaining-a','remaining-b'].map(name=>db.query("INSERT INTO public.archivo(id_usuario,nombre,tamano_bytes,id_estado) VALUES(1,$1,25165824,1)",[name])));
      assert.equal(simultaneous.filter(result=>result.status==='fulfilled').length,1);
      assert.equal(simultaneous.filter(result=>result.status==='rejected').length,1);
      await assert.rejects(db.query("INSERT INTO public.archivo(id_usuario,nombre,tamano_bytes,id_estado) VALUES(1,'excess',1,1)"), /CLOUDBOX_STORAGE_QUOTA_EXCEEDED/);
      await db.query('UPDATE public.archivo SET id_estado=3 WHERE id=1');
      await assert.rejects(db.query("INSERT INTO public.archivo(id_usuario,nombre,tamano_bytes,id_estado) VALUES(1,'pending',1,1)"), /CLOUDBOX_STORAGE_QUOTA_EXCEEDED/);
      await db.query('UPDATE public.archivo SET storage_deleted_at=now() WHERE id=1');
      await db.query("INSERT INTO public.archivo(id_usuario,nombre,tamano_bytes,id_estado) VALUES(1,'released',52428800,1)");
      await db.query('UPDATE public.plan SET id_estado=2 WHERE id=42');
      await assert.rejects(db.query("INSERT INTO public.archivo(id_usuario,nombre,tamano_bytes,id_estado) VALUES(2,'no-free',1,1)"), /CLOUDBOX_FREE_PLAN_UNAVAILABLE/);
      await db.query('UPDATE public.plan SET id_estado=1 WHERE id=42');
    });

    await t.test('folder writes reject duplicate names, owner changes and cycles', async () => {
      await db.exec("INSERT INTO public.carpeta(id_usuario,nombre,id_estado) VALUES(1,'Root',1); INSERT INTO public.carpeta(id_usuario,nombre,id_padre,id_estado) VALUES(1,'Child',1,1);");
      await assert.rejects(db.query('UPDATE public.carpeta SET id_padre=2 WHERE id=1'), /CLOUDBOX_FOLDER_CYCLE/);
      await assert.rejects(db.query("INSERT INTO public.carpeta(id_usuario,nombre,id_estado) VALUES(1,'Root',1)"), /CLOUDBOX_FOLDER_DUPLICATE/);
      await assert.rejects(db.query("INSERT INTO public.carpeta(id_usuario,nombre,id_padre,id_estado) VALUES(2,'Other',1,1)"), /CLOUDBOX_FOLDER_PARENT_INVALID/);
      await db.exec('BEGIN; UPDATE public.carpeta SET id_estado=2 WHERE id IN (1,2); COMMIT;');
      await db.exec('BEGIN; UPDATE public.carpeta SET id_estado=1 WHERE id=2; UPDATE public.carpeta SET id_estado=1 WHERE id=1; COMMIT;');
      await assert.rejects(db.query('UPDATE public.carpeta SET id_estado=2 WHERE id=1'),/CLOUDBOX_FOLDER_PARENT_INVALID/);
    });

    await t.test('ticket creation is atomic and closed tickets cannot receive messages', async () => {
      await assert.rejects(db.query("SELECT public.cloudbox_create_ticket(1,'Valid subject','files','')"));
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM public.support_ticket')).rows[0].total,0);
      const id=(await db.query("SELECT public.cloudbox_create_ticket(1,'Valid subject','files','Initial message') AS id")).rows[0].id;
      await db.query('UPDATE public.support_ticket SET updated_at=now()-interval \'1 day\' WHERE id=$1',[id]);
      await db.query("INSERT INTO public.support_message(ticket_id,id_usuario,message) VALUES($1,1,'Reply')",[id]);
      assert.ok((await db.query("SELECT updated_at>now()-interval '1 hour' AS recent FROM public.support_ticket WHERE id=$1",[id])).rows[0].recent);
      await db.query("UPDATE public.support_ticket SET status='closed' WHERE id=$1",[id]);
      await assert.rejects(db.query("INSERT INTO public.support_message(ticket_id,id_usuario,message) VALUES($1,1,'Late reply')",[id]),/CLOUDBOX_TICKET_CLOSED/);
    });

    await t.test('notification preferences affect database producers and protect other accounts', async () => {
      await db.query("UPDATE auth.users SET raw_user_meta_data=$1::jsonb",[JSON.stringify({cloudbox_preferences:{notifications:[{id:'shared',enabled:false},{id:'activity',enabled:false}]}})]);
      await db.exec("INSERT INTO public.notificacion(id_usuario,tipo) VALUES(1,'FILE_SHARED'),(1,'PAYMENT_APPROVED'),(2,'FILE_SHARED'),(1,'STORAGE_NEAR_LIMIT');");
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM public.notificacion')).rows[0].total,2);
      await assert.rejects(db.exec('SET ROLE anon; SELECT * FROM public.support_ticket;'), /permission denied/);
      await db.exec('RESET ROLE;');
    });
  } finally { await db.close(); }
});
