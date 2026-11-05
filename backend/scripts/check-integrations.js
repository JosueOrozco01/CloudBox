// Read-only installation check. Never print credentials or record contents.
const { createClient }=require('@supabase/supabase-js');
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const db=createClient(process.env.SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)})}});
(async()=>{
 const checks=[['archivo','id,storage_deleted_at'],['notificacion_administrador','id_usuario,id_log,read_at'],['solicitud_soporte','id,id_usuario,subject,category,status,created_at,updated_at'],['mensaje_soporte','id,ticket_id,id_usuario,message,created_at']];
 await Promise.all(checks.map(async([table,columns])=>{
  const result=await db.from(table).select(columns).limit(0);
  console.log(`${table}: ${result.error ? `no disponible (${result.error.code||'conexión'})` : 'disponible'}`);
  if(result.error)process.exitCode=1;
 }));
 const result=await db.storage.getBucket('avatars');console.log(`avatars: ${result.error?'no disponible':'disponible'}`);if(result.error)process.exitCode=1;
 const response=await fetch(`${process.env.SUPABASE_URL}/rest/v1/`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8000)});
 const schema=response.ok?await response.json():{};const rpc=Boolean(schema.paths?.['/rpc/cloudbox_create_ticket']);console.log(`Función crear ticket: ${rpc?'disponible':'no disponible'}`);if(!rpc)process.exitCode=1;
})().catch(()=>{console.error('No se pudo verificar la instalación de integraciones.');process.exitCode=1;});
