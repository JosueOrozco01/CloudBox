const db = require('../config/admin-client');
const crypto = require('node:crypto');
const check = result => { if (result.error) throw result.error; return result.data; };
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const id = value => { const number = Number(value); if (!Number.isSafeInteger(number) || number < 1) throw fail('Identificador inválido.'); return number; };
const text = (value, min, max) => { if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw fail(`El texto debe tener entre ${min} y ${max} caracteres.`); return value.trim(); };
const isAdmin = req => req.user.role === 'Administrador';
const ownTicket = async req => {
 const ticket = check(await db.from('support_ticket').select('*').eq('id', id(req.params.id)).maybeSingle());
 if (!ticket || (!isAdmin(req) && ticket.id_usuario !== req.user.id)) throw fail('Solicitud no encontrada.',404);
 return ticket;
};
const handler = fn => async (req,res,next) => { try { await fn(req,res); } catch(error) { next(error); } };
exports.reads = handler(async (req,res) => {
 const limit = req.query.limit === undefined ? 100 : Number(req.query.limit);
 const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
 if(!Number.isSafeInteger(limit)||limit<1||limit>200||!Number.isSafeInteger(offset)||offset<0)throw fail('Paginación inválida.');
 const logs = check(await db.from('LogAuditoria').select('id').order('fecha',{ascending:false}).order('id',{ascending:false}).range(offset,offset+limit-1));
 const ids = logs.map(log=>log.id);
 const rows = ids.length ? check(await db.from('admin_notification_read').select('id_log').eq('id_usuario',req.user.id).in('id_log',ids)) : [];
 res.json({success:true,data:rows.map(row=>row.id_log)});
});
exports.markReads = handler(async (req,res) => {
 const ids = req.body?.ids;
 if (!Array.isArray(ids) || ids.length > 200 || !ids.length) throw fail('Selecciona entre 1 y 200 eventos.');
 const unique = [...new Set(ids.map(id))];
 const logs = check(await db.from('LogAuditoria').select('id').in('id',unique));
 check(await db.from('admin_notification_read').upsert(logs.map(log=>({id_usuario:req.user.id,id_log:log.id})),{onConflict:'id_usuario,id_log'}));
 res.json({success:true});
});
exports.tickets = handler(async (req,res) => {
 const page = req.query.page === undefined ? 1 : Number(req.query.page), limit=20;
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(page*limit))throw fail('Paginación inválida.');
 let query=db.from('support_ticket').select('*,usuario:id_usuario(nombre,apellido,correo)',{count:'exact'});
 if (!isAdmin(req)) query=query.eq('id_usuario',req.user.id);
 if (req.query.status) { if (!['open','in_progress','closed'].includes(req.query.status)) throw fail('Estado inválido.'); query=query.eq('status',req.query.status); }
 const result=await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*limit,page*limit-1);
 res.json({success:true,data:check(result),pagination:{total:result.count,page,totalPages:Math.ceil(result.count/limit)}});
});
exports.createTicket = handler(async (req,res) => {
 const subject=text(req.body?.subject,3,150), message=text(req.body?.message,1,4000),category=req.body?.category;
 if (!['files','sharing','storage','payments','security','other'].includes(category)) throw fail('Selecciona una categoría.');
 const ticket=check(await db.rpc('cloudbox_create_ticket',{p_user:req.user.id,p_subject:subject,p_category:category,p_message:message}));
 res.status(201).json({success:true,data:{id:ticket}});
});
exports.ticketDetail = handler(async (req,res) => {
 const ticket=await ownTicket(req);
 const messages=check(await db.from('support_message').select('*,usuario:id_usuario(nombre,apellido)').eq('ticket_id',ticket.id).order('id'));
 res.json({success:true,data:{...ticket,messages}});
});
exports.reply = handler(async (req,res) => {
 const ticket=await ownTicket(req);
 if(ticket.status==='closed') throw fail('La solicitud está cerrada.');
 const message=text(req.body?.message,1,4000);
 check(await db.from('support_message').insert({ticket_id:ticket.id,id_usuario:req.user.id,message}));
 res.status(201).json({success:true});
});
exports.ticketStatus = handler(async (req,res) => {
 const ticket=await ownTicket(req), status=req.body?.status;
 if(!['open','in_progress','closed'].includes(status) || (!isAdmin(req) && status!=='closed')) throw fail('Cambio de estado no permitido.',403);
 check(await db.from('support_ticket').update({status,updated_at:new Date().toISOString()}).eq('id',ticket.id));
 res.json({success:true});
});
exports.avatarUrl = async authUser => {
 const path=authUser?.user_metadata?.avatar_path;
 if(path) return check(await db.storage.from('avatars').createSignedUrl(path,3600)).signedUrl;
 return authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null;
};
exports.avatar = handler(async (req,res) => {
 const file=req.file, b=file?.buffer;
 const type=b && b.length>=12 ? (b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : b[0]===255 && b[1]===216 && b[2]===255 ? 'image/jpeg' : b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP' ? 'image/webp' : null) : null;
 if(!type || type!==file.mimetype) throw fail('Selecciona una imagen PNG, JPG o WebP válida.');
 const path=`${req.user.authUserId}/${crypto.randomUUID()}.${type==='image/png'?'png':type==='image/jpeg'?'jpg':'webp'}`;
 check(await db.storage.from('avatars').upload(path,b,{contentType:type,upsert:false}));
 try { check(await db.auth.admin.updateUserById(req.user.authUserId,{user_metadata:{...req.authUser.user_metadata,avatar_path:path}})); }
 catch(error) { await db.storage.from('avatars').remove([path]); throw error; }
 const old=req.authUser.user_metadata?.avatar_path;
 if(old?.startsWith(`${req.user.authUserId}/`)) await db.storage.from('avatars').remove([old]);
 res.json({success:true,data:{avatarUrl:check(await db.storage.from('avatars').createSignedUrl(path,3600)).signedUrl}});
});

exports.userCatalog = handler(async (req,res) => {
 const [states,roles,plans] = await Promise.all(['estado_usuario','rol','plan'].map(table=>db.from(table).select('id,nombre')));
 const counts=await Promise.all([null,'Activo','Pendiente','Inactivo','Suspendido'].map(async name=>{
   let query=db.from('usuario').select('id',{count:'exact',head:true});
   if(name) { const state=check(states).find(row=>row.nombre===name); if(!state)return 0; query=query.eq('id_estado',state.id); }
   const result=await query; check(result); return result.count;
 }));
 res.json({success:true,data:{states:check(states),roles:check(roles),plans:[...check(plans).map(row=>row.nombre),'Sin suscripción activa'],stats:[{id:'total',label:'Usuarios totales',value:counts[0]},{id:'active',label:'Usuarios activos',value:counts[1]},{id:'pending',label:'Pendientes',value:counts[2]},{id:'inactive',label:'Inactivos / Suspendidos',value:counts[3]+counts[4]}]}});
});
