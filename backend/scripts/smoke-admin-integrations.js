// Read-only smoke checks against the configured Supabase project.
const service=require('../src/services/admin.service');
const reports=require('../src/services/report.service');
const run=async(label,fn)=>{try{await fn();console.log(`${label}: correcto`);}catch(error){console.log(`${label}: falló (${error.code||error.status||'consulta'})`);process.exitCode=1;}};
(async()=>{
 let first;
 await run('Listado paginado',async()=>{const result=await service.getUsersList({page:1,limit:10});if(!Array.isArray(result.users)||!result.pagination)throw new Error('Invalid response');first=result.users[0];});
 if(first){await run('Detalle individual',()=>service.getUserById(first.id));await run('Filtros de usuarios',()=>service.getUsersList({page:1,limit:10,plan:first.plan,days:'30',sort:'name',status:first.estado}));}
 await run('Reporte completo de almacenamiento',()=>reports.getStorageReport());
})().catch(()=>{console.log('No se pudieron completar las comprobaciones.');process.exitCode=1;});
