// Run without --apply to count pending work. --apply retries only rows already
// marked deleted; it never marks an active or trashed file for deletion.
require('dotenv').config();
const db = require('../src/config/admin-client');
const storage = require('../src/services/storage.service');
const files = require('../src/services/file.service');
async function reconcile(apply = false) {
  const totals = { pending: 0, completed: 0, failed: 0 };
  let cursor = 0;
  for (;;) {
    const {data,error}=await db.from('archivo').select('id,id_usuario,ruta_storage')
      .eq('id_estado',3).is('storage_deleted_at',null).gt('id',cursor).order('id').limit(100);
    if(error) throw error;
    if(!data.length) break;
    for(const file of data) {
      cursor=file.id;totals.pending++;
      if(!apply) continue;
      try {
        await storage.deleteFile(file.ruta_storage);
        await files.confirmStorageDeletion(file.id,file.id_usuario);
        totals.completed++;
      } catch { totals.failed++; }
    }
  }
  cursor=0;
  for (;;) {
    const {data,error}=await db.from('limpieza_almacenamiento').select('id,storage_path').gt('id',cursor).order('id').limit(100);
    if(error) throw error;
    if(!data.length) return totals;
    for(const entry of data) {
      cursor=entry.id;totals.pending++;
      if(!apply) continue;
      try {
        const reference=await db.from('archivo').select('id').eq('ruta_storage',entry.storage_path).limit(1).maybeSingle();
        if(reference.error) throw reference.error;
        if(!reference.data) await storage.deleteFile(entry.storage_path);
        const removed=await db.from('limpieza_almacenamiento').delete().eq('id',entry.id);
        if(removed.error) throw removed.error;
        totals.completed++;
      } catch { totals.failed++; }
    }
  }
}
reconcile(process.argv.includes('--apply')).then(result=>{
  console.log(JSON.stringify(result));
  if(result.failed) process.exitCode=1;
}).catch(()=>{console.error('No se pudo reconciliar el almacenamiento. Verifica conexión e instalación.');process.exitCode=1;});
