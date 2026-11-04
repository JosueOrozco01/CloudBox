const {createClient}=require('@supabase/supabase-js');
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const db=createClient(process.env.SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
(async()=>{
 for(const [table,columns] of [['admin_notification_read','id_usuario,id_log,read_at'],['support_ticket','id,id_usuario,subject,category,status,created_at,updated_at'],['support_message','id,ticket_id,id_usuario,message,created_at']]){
  const result=await db.from(table).select(columns).limit(0);console.log(`${table}: ${result.error?result.error.code:'columnas compatibles'}`);if(result.error)process.exitCode=1;
 }
 const response=await fetch(`${process.env.SUPABASE_URL}/rest/v1/`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8000)});
 if(response.ok){const schema=await response.json();console.log('RPC crear ticket:',Boolean(schema.paths?.['/rpc/cloudbox_create_ticket']));if(!schema.paths?.['/rpc/cloudbox_create_ticket'])process.exitCode=1;}
 const bucket=await db.storage.getBucket('avatars');
 if(bucket.error){const result=await db.storage.createBucket('avatars',{public:false,fileSizeLimit:2097152,allowedMimeTypes:['image/jpeg','image/png','image/webp']});console.log('Bucket avatars:',result.error?'no se pudo crear':'creado privado');}
 else console.log('Bucket avatars: disponible');
})().catch(()=>{console.error('No se pudo validar el esquema remoto.');process.exitCode=1;});
