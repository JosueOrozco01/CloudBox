// Run against a local Vite server and a headless Chromium debugging endpoint.
// All API requests are intercepted: this suite never uses real accounts or data.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.UI_TEST_ORIGIN || 'http://127.0.0.1:5178';
const debug = process.env.UI_TEST_BROWSER || 'http://127.0.0.1:9238';
const targets = await fetch(`${debug}/json`).then(r => r.json());
const target = targets.find(t => t.type === 'page');
assert.ok(target, 'A Chromium page must be available');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map(), requests = [], exceptions = [];
let trashFiles = [{ id: 1, id_usuario: 1, nombre: 'documento.pdf', tamano_bytes: 1000, fecha_subida: '2026-10-30' }, { id: 2, id_usuario: 1, nombre: 'Imagen anterior.png', tamano_bytes: 2048, fecha_subida: '2026-10-29' }];
let trashFolders = [{ id: 71, id_usuario: 1, nombre: 'Recuerdos', fecha_creacion: '2026-10-28' }];
let profileValues = { nombre: 'Cuenta', apellido: 'Prueba', fecha_registro: '2026-10-01', estado: 'Activo' };
let savedPreferences = { theme: 'claro', language: 'Español (América Latina)', showKB: false, notifications: [{ id: 'storage', enabled: false }, { id: 'renewal', enabled: false }, { id: 'shared', enabled: false }, { id: 'activity', enabled: false }] };
let savedPreferencesB = { ...savedPreferences, notifications: savedPreferences.notifications.map(item=>({ ...item })) };
let failPreferencesB = false;
let backendDelay = 0;
let registeredSessions = [{ id: 1, device: 'Chrome · Windows', ip: '127.0.0.1', location: 'Ubicación local', isCurrent: true, startedAt: '2026-10-30T17:00:00Z' }, { id: 2, device: 'Safari · iPhone', ip: '192.0.2.2', location: 'Ubicación no disponible', isCurrent: false, startedAt: '2026-10-29T15:00:00Z' }];
let admin = false, failCurrent = false, rejectPayment = false;
const plans = [{ id: 1, nombre: 'Free', precio: 0, espacio_maximo_gb: 1, vigencia_dias: 36500, id_estado: 1, estado: 'Activo' }, { id: 2, nombre: 'Básico', precio: 29, espacio_maximo_gb: 5, vigencia_dias: 30, id_estado: 1, estado: 'Activo' }, { id: 3, nombre: 'Pro', precio: 89, espacio_maximo_gb: 50, vigencia_dias: 30, id_estado: 2, estado: 'Inactivo' }];
plans.push({ id: 4, nombre: 'Equipo', precio: 129, espacio_maximo_gb: 100, vigencia_dias: 30, id_estado: 1, estado: 'Activo' });
let notifications = [{ id: 1, titulo: 'Archivo compartido', mensaje: 'Te compartieron un documento.', tipo_recurso: 'archivo', fecha_creacion: '2026-10-30', leida: false }];
const ownFolders = [{ id: 51, id_usuario: 1, id_padre: null, nombre: 'Documentos', fecha_creacion: '2026-10-30' }];
const ownFiles = [{ id: 52, id_usuario: 1, id_carpeta: null, nombre: 'Informe.pdf', tamano_bytes: 2048, fecha_subida: '2026-10-30T17:00:00Z' }, { id: 53, id_usuario: 1, id_carpeta: null, nombre: 'Portada.png', tamano_bytes: 3145728, fecha_subida: '2026-10-29T15:00:00Z' }, { id: 54, id_usuario: 1, id_carpeta: 51, nombre: 'Borrador.docx', tamano_bytes: 4096, fecha_subida: '2026-10-29T10:00:00Z' }];
let favoriteFiles = [], sentShareActive = true;
const receivedFile = { id: 21, id_permiso: 2, fecha_compartido: '2026-10-29', emisor: { nombre: 'Ana', apellido: 'López', correo: 'ana@example.invalid' }, archivo: { id: 31, nombre: 'Guía.pdf', id_estado: 1 } };
const receivedImage = { id: 23, id_permiso: 1, fecha_compartido: '2026-10-28', emisor: { nombre: 'Mario', apellido: 'Pérez', correo: 'mario@example.invalid' }, archivo: { id: 34, nombre: 'Diseño.png', id_estado: 1 } };
const receivedFolder = { id: 22, id_permiso: 1, fecha_compartido: '2026-10-28', emisor: { nombre: 'Ana', apellido: 'López', correo: 'ana@example.invalid' }, carpeta: { id: 41, nombre: 'Proyecto equipo', id_estado: 1 } };
const sentShare = { id: 24, id_permiso: 2, fecha_compartido: '2026-10-29', receptor: { nombre: 'Diego', apellido: 'Ruiz', correo: 'diego@example.invalid' }, emisor: { correo: 'test@example.invalid' }, archivo: { id: 32, nombre: 'Presupuesto.pdf', id_estado: 1 } };
const current = { id: 1, planId: 2, planName: 'Básico', price: 29, status: 'Activa', startDate: '2026-10-01', endDate: '2026-11-01' };
const storageUser = { id: 1, nombre_completo: 'Cuenta de prueba', correo: 'test@example.invalid', usedBytes: 1073741824, maxBytes: 5368709120, percentageUsed: 20, fileCount: 2, folderCount: 1, plan: 'Básico' };
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
function mock(url, method, body, headers = {}) {
  const isAccountB = Object.entries(headers).some(([key, value]) => key.toLowerCase() === 'authorization' && value === 'Bearer ui-test-b');
  const path = url.pathname.replace(/^.*\/api/, '');
  requests.push({ path, method, body, search: url.search });
  if (path === '/auth/login') { const isB = body.email === 'b@example.invalid'; return { envelope: { token: isB ? 'ui-test-b' : 'ui-test-only', refreshToken: isB ? 'ui-refresh-b' : 'ui-refresh-a', user: { id: isB ? 2 : 1, nombre: isB ? 'Cuenta B' : profileValues.nombre, apellido: 'Prueba', correo: body.email } } }; }
  if (path === '/auth/logout') return {};
  if (path === '/users/me') { if (method === 'PATCH' && !isAccountB) Object.assign(profileValues, body); return { id: isAccountB ? 2 : 1, ...profileValues, nombre: isAccountB ? 'Cuenta B' : profileValues.nombre, correo: isAccountB ? 'b@example.invalid' : 'test@example.invalid', permissions: !isAccountB && admin ? ['admin_panel', 'manage_users'] : [], rol: !isAccountB && admin ? 'Administrador' : 'Cliente' }; }
  if (path === '/users/me/security') return { sessions: registeredSessions };
  if (path === '/users/me/password') return { message: 'Contraseña actualizada correctamente.' };
  if (path === '/users/me/logout-others') { registeredSessions = registeredSessions.filter(session=>session.isCurrent); return { message: 'Otras sesiones cerradas correctamente.' }; }

  if (path === '/shares/received/files') return [receivedFile, receivedImage];
  if (path === '/shares/received/folders') return [receivedFolder];
  if (path === '/shares/sent') return sentShareActive ? [sentShare] : [];
  if (path === '/shares/folders/41/content') return { access: { isOwner: false, permissionId: 1 }, folders: [], files: [{ id: 33, nombre: 'Notas.txt', id_estado: 1 }] };
  if (/^\/shares\/\d+$/.test(path)) { const share = [receivedFile, receivedImage, receivedFolder, sentShare].find(row => row.id === Number(path.split('/')[2])); return { ...share, permiso: { nombre: share.id_permiso === 1 ? 'Editor' : 'Visualizador' } }; }
  if (path === '/shares/24/permission') { sentShare.id_permiso = body.permissionId; return sentShare; }
  if (path === '/shares/24/revoke') { sentShareActive = false; return {}; }
  if (path === '/favorites') return favoriteFiles;
  if (/^\/favorites\/\d+$/.test(path)) { const id = Number(path.split('/')[2]); favoriteFiles = method === 'POST' ? [...favoriteFiles, { id_archivo: id, archivo: ownFiles.find(row=>row.id === id) || receivedFile.archivo }] : favoriteFiles.filter(row => row.id_archivo !== id); return {}; }
  if (path === '/folders/locations') return ownFolders.map(folder=>({id:folder.id,name:folder.nombre}));
  if (path === '/folders') return ownFolders.filter(row=>row.id_padre == null);
  if (/^\/folders\/\d+\/subfolders$/.test(path)) return ownFolders.filter(row=>row.id_padre === Number(path.split('/')[2]));
  if (path === '/files') return ownFiles.filter(row=>row.id_carpeta === (url.searchParams.get('folderId') && url.searchParams.get('folderId') !== 'null' ? Number(url.searchParams.get('folderId')) : null));
  if (path === '/files/52/rename') { ownFiles.find(row=>row.id === 52).nombre = body.name; return ownFiles.find(row=>row.id === 52); }

  if (path === '/dashboard') return { fileCount: ownFiles.length, folderCount: ownFolders.length, recentFiles: [] };
  if (path === '/users/me/storage') return { usedBytes: 1000, maxBytes: 5368709120, availableBytes: 5368708120, percentageUsed: 0, plan: { nombre: 'Básico' } };
  if (path === '/files/trash') return trashFiles;
  if (path === '/folders/trash') return trashFolders;
  if (path === '/files/2/restore') { trashFiles = trashFiles.filter(row=>row.id !== 2); return { id: 2 }; }
  if (path === '/folders/71/restore') { trashFolders = []; return { id: 71 }; }
  if (path === '/files/1/permanent' && method === 'DELETE') { trashFiles = []; return { id: 1 }; }
  if (path === '/users/me/preferences') { if (isAccountB) { if (method === 'GET' && failPreferencesB) throw { status: 503, message: 'Preferencias temporalmente no disponibles' }; if (method === 'PATCH') savedPreferencesB = { ...savedPreferencesB, ...body }; return savedPreferencesB; } if (method === 'PATCH') savedPreferences = { ...savedPreferences, ...body }; return savedPreferences; }
  if (path === '/plans/admin/all') return plans;
  if (path === '/plans' && method === 'GET') return plans.filter(p => p.id_estado === 1);
  if (/^\/plans\/\d+\/status$/.test(path)) { const plan = plans.find(p => p.id === Number(path.split('/')[2])); Object.assign(plan, body, { estado: body.id_estado === 1 ? 'Activo' : 'Inactivo' }); return plan; }
  if (/^\/plans\/\d+$/.test(path)) { const plan = plans.find(p => p.id === Number(path.split('/')[2])); if (method === 'PUT') Object.assign(plan, body); return plan; }
  if (path === '/plans' && method === 'POST') { const plan = { ...body, id: 5, id_estado: 1, estado: 'Activo' }; plans.push(plan); return plan; }
  if (path === '/subscriptions/current') { if (failCurrent) throw { status: 503, message: 'No se pudo consultar la suscripción' }; return current; }
  if (path === '/subscriptions/history') return [current];
  if (path.startsWith('/subscriptions/')) { if (rejectPayment) throw { status: 402, message: 'Pago rechazado' }; return { success: true, scheduled: path.endsWith('cancel'), effectiveOn: '2026-11-01', creditApplied: 14.5, amountDue: 74.5 }; }
  if (path === '/storage/quota-summary') return { espacio_usado_bytes: 1073741824, espacio_disponible_bytes: 4294967296, porcentaje_uso: 20 };
  if (path === '/payments/methods') return [{ id: 1, nombre: 'Tarjeta simulada' }];
  const payment = { id: 1, referenceCode: 'CB-TEST-123', transactionId: 'TRX-TEST', amount: 29, paymentStatusId: 1, paidAt: '2026-10-30' };
  if (path === '/payments/history') return [payment, { ...payment, id: 2, referenceCode: 'CB-REJECT-456', paymentStatusId: 2, amount: 89 }];
  if (path === '/payments/1') return payment;
  if (path === '/payments/1/receipt/download') return { url: origin + '/ui-test-receipt.pdf' };
  if (path === '/ui-test-receipt.pdf') return { binary: '%PDF-1.4\n%%EOF', contentType: 'application/pdf' };
  if (path === '/payments/1/receipt') return { receiptNumber: 'CB-000001', issuedAt: '2026-10-30', amount: 29 };
  if (path.startsWith('/notifications')) {
    if (method === 'DELETE') { notifications = notifications.filter(n => n.id !== Number(path.split('/')[2])); return undefined; }
    if (method === 'PATCH') { notifications.filter(n => path.endsWith('/read-all') || n.id === Number(path.split('/')[2])).forEach(n => n.leida = true); return { updatedCount: 1 }; }
    return path.endsWith('/unread') ? notifications.filter(n => !n.leida) : notifications;
  }
  if (path === '/activity') {
    const entries = [
      { id: 4, fecha: '2026-10-30T17:30:00Z', descripcion: 'Subiste un documento de prueba', accion: { nombre: 'Subir archivo' } },
      { id: 3, fecha: '2026-10-30T16:15:00Z', descripcion: 'Acceso autorizado a proyecto.pdf', accion: { nombre: 'Descargar archivo' } },
      { id: 2, fecha: '2026-10-29T15:00:00Z', descripcion: 'Compartiste notas.pdf con otra cuenta', accion: { nombre: 'Compartir archivo' } },
      { id: 1, fecha: '2026-10-28', descripcion: 'Creaste la carpeta Proyectos', accion: { nombre: 'Crear carpeta' } },
    ];
    return entries.filter(row => (!url.searchParams.get('action') || row.accion.nombre === url.searchParams.get('action')) && (!url.searchParams.get('from') || row.fecha.slice(0,10) >= url.searchParams.get('from')) && (!url.searchParams.get('to') || row.fecha.slice(0,10) <= url.searchParams.get('to')));
  }
  if (path === '/admin/subscriptions') return { envelope: { data: [{ id: 1, usuario: { nombre: 'Cuenta', correo: 'test@example.invalid' }, plan: { nombre: 'Básico', precio: 29 }, estado: 'Activa', fecha_inicio: '2026-10-01', fecha_vencimiento: '2026-11-01' }], pagination: { totalRecords: 1, totalPages: 1 } } };
  if (path === '/admin/storage/overview') return { totalBytes: 1073741824, totalFiles: 2, totalFolders: 1 };
  if (path.startsWith('/admin/storage/')) return { envelope: { data: path.endsWith('over-quota') ? [] : [storageUser], pagination: { total: path.endsWith('over-quota') ? 0 : 1 } } };
  if (path === '/admin/audit-logs') return { logs: [], total: 0 };
  if (path.startsWith('/admin/reports/')) {
    if (path.endsWith('/export')) return { binary: url.searchParams.get('format') === 'pdf' ? '%PDF-1.4\n%%EOF' : 'Plan,Total\nBasico,29', contentType: url.searchParams.get('format') === 'pdf' ? 'application/pdf' : 'text/csv' };
    const distribution = { pdf: { cantidad: 2, bytes: 12345, count: 2 } };
    if (path.endsWith('storage')) return { consumoGlobal: { totalGb: 1, totalArchivos: 2 }, alertasCuota: { totalSobreCuota: 0, totalProximosCuota: 0 }, distribucionTipo: distribution, distribucionEstado: [{ estado: 'Activo', cantidad: 2, bytes: 12345 }] };
    if (path.endsWith('revenue')) return { resumen: { ingresosTotales: 29, totalTransacciones: 1 }, desgloseMensual: [{ mes: '2026-10', total: 29, transacciones: 1 }], ingresosPorPlan: [{ plan: 'Básico', total: 29 }] };
    return { kpis: { totalUsuarios: 1, ingresosTotales: 29 }, usuarios: { distribucionEstado: [{ estado: 'Activo', cantidad: 1 }] }, suscripciones: { distribucionPlanes: [{ plan: 'Básico', cantidad: 1 }] }, ingresos: { desgloseMensual: [{ mes: '2026-10', total: 29 }] }, almacenamiento: { distribucionTipo: distribution } };
  }
  throw { status: 404, message: `Fixture missing: ${path}` };
}
socket.onmessage = async event => {
  const message = JSON.parse(event.data);
  if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result); return; }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text + ' ' + (message.params.exceptionDetails.exception?.description || ''));
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params;
    let status = 200, result, binary;
    try {
      const data = request.method === 'OPTIONS' ? undefined : mock(new URL(request.url), request.method, request.postData ? JSON.parse(request.postData) : null, request.headers);
      if (data === undefined) status = 204;
      binary = data?.binary ? data : null;
      result = data?.envelope || { success: true, data };
    } catch (err) { status = err.status || 500; result = { success: false, message: err.message }; }
    if (backendDelay) await new Promise(resolve => setTimeout(resolve, backendDelay));
    try {
      await send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: binary?.contentType || 'application/json' }, ...(binary ? [{ name: 'Content-Disposition', value: 'attachment; filename=ui-test.pdf' }] : []), { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization,Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }], body: status === 204 ? '' : Buffer.from(binary?.binary || JSON.stringify(result)).toString('base64') });
    } catch (error) {
      // Navigation cancels outstanding intercepted requests. Other CDP errors fail the suite.
      if (!error.message.includes('Invalid InterceptionId')) throw error;
    }
  }
};
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const waitFor = async (expression, label) => {
  for (let i = 0, deadline = Date.now()+20000; i < 300 && Date.now()<deadline; i++) { if (await evaluate(`!!document.body && (${expression})`)) return; await new Promise(r => setTimeout(r, 50)); }
  throw new Error(`Timed out: ${label}\n${await evaluate('document.body.innerText')}\nExceptions: ${JSON.stringify(exceptions)}\nRecent requests: ${JSON.stringify(requests.slice(-5))}`);
};
const text = value => `document.body.innerText.includes(${JSON.stringify(value)})`;
const click = async label => {
  const find = `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)} && !b.disabled)`;
  await waitFor(`!!(${find})`, `button ${label}`);
  return evaluate(`(${find}).click()`);
};
const select = (index, value) => evaluate(`(()=>{const e=document.querySelectorAll('select')[${index}];Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
async function visit(path, expected) { console.log('Checking route '+path); await send('Page.navigate', { url: origin + path }); await waitFor(text(expected), path); await waitFor(`!document.querySelector('[aria-busy="true"]')`, 'loaded'); }
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'deny' });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }, { urlPattern: '*/ui-test-receipt.pdf' }] });
  const authInit = await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('token','ui-test-only');" });
  await visit('/planes', 'Un plan para cada espacio');
  assert.equal(await evaluate("[...document.querySelectorAll('h2')].some(e=>e.textContent==='Pro')"), false, 'Public catalog must exclude inactive plans');
  await visit('/plan', 'Mi plan');
  await waitFor("!!document.querySelector('.plans-storage-ring')", 'plan overview storage');
  assert.equal(await evaluate("document.querySelector('.plans-storage-ring').getAttribute('aria-valuenow')"), '20');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  const planDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-plan-desktop.png'), Buffer.from(planDesktop.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.documentElement.dataset.theme='dark'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Plan overview mobile has no overflow');
  const planMobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-plan-mobile.png'), Buffer.from(planMobile.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.documentElement.dataset.theme='light'");
  assert.ok(await evaluate("getComputedStyle(document.querySelector('.module-page')).fontFamily.includes('Manrope')"));
  assert.ok(await evaluate("getComputedStyle(document.querySelector('h1')).fontFamily.includes('Outfit')"));
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.module-button.primary')).backgroundColor"), 'rgb(37, 99, 255)');
  await evaluate("document.querySelector('[aria-controls=client-notification-panel]').click()");
  await waitFor("!!document.querySelector('#client-notification-panel .unread')", 'client notification dropdown');
  assert.ok(await evaluate("!!document.querySelector('#client-notification-panel.admin-notification-panel')"));
  await evaluate("document.querySelector('#client-notification-panel .unread').click()");
  await waitFor(text('Detalle de notificación'), 'notification detail modal');
  assert.ok(await evaluate("!!document.querySelector('.cf-modal.module-dialog .cf-header-icon')"));
  await click('Cerrar');
  notifications[0].leida = false;
  await evaluate("window.dispatchEvent(new Event('notifications-changed'))");
  await evaluate("document.querySelector('[aria-controls=client-notification-panel]').click()");
  await waitFor("!!document.querySelector('#client-notification-panel .unread')", 'reset unread notification');
  await evaluate("document.querySelector('#client-notification-panel [aria-label=\"Marcar todas como leídas\"]').click()");
  await waitFor("document.querySelector('#client-notification-panel header p')?.textContent === 'Estás al día'", 'read all in dropdown');
  assert.ok(requests.some(r=>r.path === '/notifications/read-all' && r.method === 'PATCH'));
  await evaluate("document.documentElement.dataset.theme='dark'");
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  const notificationScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-client-notifications.png'), Buffer.from(notificationScreenshot.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.documentElement.dataset.theme='light'");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await waitFor("!document.querySelector('#client-notification-panel')", 'close dropdown with Escape');
  notifications[0].leida = false;
  await click('Renovar plan');
  assert.ok(await evaluate("!!document.querySelector('.cf-backdrop .cf-modal .cf-header-icon')"));
  await evaluate("Promise.all(document.getAnimations().map(animation => animation.finished))");
  const modalScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-module-dialog.png'), Buffer.from(modalScreenshot.data, 'base64'));
  await select(0, '1'); await click('Confirmar operación');
  await waitFor(text('Operación completada.'), 'renewal result');
  assert.ok(requests.some(r => r.path === '/subscriptions/renew' && r.body.paymentMethodId === 1 && r.body.referenceCode.startsWith('CB-')));
  await click('Elegir plan'); await select(0, '1'); await click('Confirmar operación'); await waitFor(text('Operación completada.'), 'upgrade result');
  assert.ok(requests.some(r => r.path === '/subscriptions/change-plan' && r.body.newPlanId === 4));
  await click('Cancelar suscripción'); await click('Confirmar operación'); await waitFor(text('Operación programada'), 'scheduled cancellation');
  rejectPayment = true;
  await click('Renovar plan'); await select(0, '1'); await click('Confirmar operación'); await waitFor(text('Pago rechazado'), 'declined payment');
  rejectPayment = false;
  await visit('/pagos', 'Pagos y comprobantes');
  await waitFor("document.querySelectorAll('.payments-history tbody tr').length === 2", 'payments history');
  assert.ok(await evaluate("document.querySelector('.payments-total').textContent.includes('29')"), 'Summary includes approved amounts only');
  await select(0, '2');
  await waitFor("document.querySelectorAll('.payments-history tbody tr').length === 1", 'rejected payment filter');
  assert.ok(await evaluate("document.querySelector('.payments-history tbody tr').textContent.includes('Rechazado')"));
  assert.equal(await evaluate("[...document.querySelectorAll('.payments-row-actions button')].filter(b=>b.textContent.trim()!=='Detalle').every(b=>b.disabled)"), true, 'Rejected payments cannot request receipts');
  await select(0, 'all');
  await evaluate("document.querySelector('.payments-search input').focus()");
  await send('Input.insertText', { text: 'CB-TEST-123' });
  await waitFor("document.querySelectorAll('.payments-history tbody tr').length === 1", 'payment reference search');
  await evaluate("document.querySelector('[aria-label=\"Limpiar búsqueda de pagos\"]').click()");
  await waitFor("document.querySelectorAll('.payments-history tbody tr').length === 2", 'reset payment search');
  const paymentDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-payments-desktop.png'), Buffer.from(paymentDesktop.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.documentElement.dataset.theme='dark'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Payments mobile has no overflow');
  const paymentMobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-payments-mobile.png'), Buffer.from(paymentMobile.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.documentElement.dataset.theme='light'");
  await click('Detalle'); await waitFor(text('TRX-TEST'), 'payment detail');
  await evaluate("document.querySelector('[aria-label=\"Cerrar\"]').click()"); await click('Comprobante'); await waitFor(text('CB-000001'), 'receipt detail');
  await evaluate("Promise.all(document.getAnimations().map(animation => animation.finished))");
  const receiptScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-payments-receipt.png'), Buffer.from(receiptScreenshot.data, 'base64'));
  await click('Descargar PDF');
  await waitFor("[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.trim()==='Descargar PDF')?.disabled === false", 'download from receipt modal');

  await evaluate("document.querySelector('[aria-label=\"Cerrar\"]').click()"); await click('PDF'); await waitFor("!document.querySelector('[role=alert]')", 'receipt download');
  assert.ok(requests.some(r => r.path === '/payments/1/receipt/download'));
  await visit('/actividad', 'Mi actividad'); await waitFor(text('Subiste un documento'), 'activity');
  await waitFor("document.querySelectorAll('.activity-entry').length === 4", 'activity timeline entries');
  assert.equal(await evaluate("document.querySelectorAll('.activity-day').length"), 3, 'Timeline groups by date');
  assert.ok(await evaluate(text('Acceso de descarga autorizado')));
  await click('Descargas'); await waitFor("document.querySelectorAll('.activity-entry').length === 1", 'quick download filter');
  assert.ok(await evaluate("document.querySelector('.activity-entry h3').textContent === 'Descargar archivo'"));
  await click('Todo'); await waitFor("document.querySelectorAll('.activity-entry').length === 4", 'all activity');
  for (let i = 0; i < 2; i++) {
    await evaluate(`(()=>{const e=document.querySelectorAll('.activity-filter-form input[type=date]')[${i}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2026-10-29');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  await click('Aplicar filtros'); await waitFor("document.querySelectorAll('.activity-entry').length === 1", 'date range filter');
  assert.ok(await evaluate("document.querySelector('.activity-entry h3').textContent === 'Compartir archivo'"));
  assert.ok(requests.some(r=>r.path === '/activity' && r.search.includes('from=2026-10-29') && r.search.includes('to=2026-10-29')));
  await click('Limpiar'); await waitFor("document.querySelectorAll('.activity-entry').length === 4", 'reset activity dates');
  await evaluate("document.querySelector('.activity-search input').focus()"); await send('Input.insertText', { text: 'documento' });
  await waitFor("document.querySelectorAll('.activity-entry').length === 1", 'activity search');
  await evaluate("document.querySelector('[aria-label=\"Limpiar búsqueda de actividad\"]').click()");
  await waitFor("document.querySelectorAll('.activity-entry').length === 4", 'reset local search');
  const activityDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-activity-desktop.png'), Buffer.from(activityDesktop.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.documentElement.dataset.theme='dark'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Activity mobile has no overflow');
  const activityMobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-activity-mobile.png'), Buffer.from(activityMobile.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.documentElement.dataset.theme='light'");
  await select(0, 'Subir archivo'); await click('Aplicar filtros'); await waitFor("document.querySelectorAll('.activity-entry').length === 1", 'action filter');
  await select(0, 'Eliminar archivo'); await click('Aplicar filtros'); await waitFor(text('No hay registros'), 'filtered empty activity');
  await visit('/compartidos', 'Compartidos conmigo');
  await waitFor("document.querySelectorAll('.sc-table tbody tr').length === 3", 'shared resources');
  await evaluate("document.querySelector('[aria-label=\"Agregar a favoritos: Guía.pdf\"]').click()");
  await waitFor("document.querySelector('[aria-label=\"Quitar de favoritos: Guía.pdf\"]')?.getAttribute('aria-pressed') === 'true'", 'shared favorite');
  assert.ok(requests.some(r=>r.path === '/favorites/31' && r.method === 'POST'));
  await click('Carpetas'); await waitFor("document.querySelectorAll('.sc-table tbody tr').length === 1", 'shared folder tab');
  await click('Todos');
  await evaluate("document.querySelector('#sc-shared-search').focus()"); await send('Input.insertText', { text: 'Guía' });
  await waitFor("document.querySelectorAll('.sc-table tbody tr').length === 1", 'shared search');
  await evaluate("document.querySelector('[aria-label=\"Limpiar búsqueda de compartidos\"]').click()");
  await waitFor("document.querySelectorAll('.sc-table tbody tr').length === 3", 'shared reset');
  const sharedDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-shared-desktop.png'), Buffer.from(sharedDesktop.data, 'base64'));
  await evaluate("document.querySelector('[aria-label=\"Ver en cuadrícula\"]').click()");
  assert.ok(await evaluate("!!document.querySelector('.sc-table-wrap.sc-grid')"));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.documentElement.dataset.theme='dark'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Shared grid mobile has no overflow');
  const sharedMobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-shared-mobile.png'), Buffer.from(sharedMobile.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.documentElement.dataset.theme='light'");
  await click('Proyecto equipo'); await waitFor(text('Notas.txt'), 'shared folder navigation');
  await click('Volver a compartidos'); await waitFor(text('Guía.pdf'), 'back from shared folder');
  await evaluate("document.querySelector('[aria-label=\"Información\"]').click()");
  await waitFor(text('Información del compartido'), 'shared detail dialog'); await click('Listo');
  await click('Compartir'); await waitFor(text('Compartir recurso'), 'share form');
  await evaluate("document.querySelector('[role=dialog] [aria-label=\"Cerrar\"]').click()");
  await click('Compartidos por mí'); await waitFor(text('Presupuesto.pdf'), 'sent shares');
  await evaluate("document.querySelector('[aria-label=\"Información\"]').click()");
  await waitFor(text('Administrar acceso'), 'share access controls');
  await evaluate("(()=>{const e=document.querySelector('.sc-access-controls select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'1');e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await waitFor(text('Permiso actualizado correctamente.'), 'updated share permission');
  assert.ok(requests.some(r=>r.path === '/shares/24/permission' && r.body.permissionId === 1));
  await waitFor("document.querySelectorAll('.sc-table tbody tr').length === 1", 'sent shares reload');
  await evaluate("document.querySelector('[aria-label=\"Información\"]').click()");
  await waitFor(text('Administrar acceso'), 'reopen share access'); await click('Revocar acceso');
  await waitFor(text('Acceso revocado correctamente.'), 'revoked share');
  assert.ok(requests.some(r=>r.path === '/shares/24/revoke' && r.method === 'PATCH'));
  notifications.push({ id: 2, titulo: 'Pago aprobado', mensaje: 'Tu pago de prueba fue aprobado.', tipo: 'PAYMENT_APPROVED', tipo_recurso: 'pago', fecha_creacion: '2026-10-30', leida: false }, { id: 3, titulo: 'Tu almacenamiento', mensaje: 'Revisa el espacio disponible en tu plan.', tipo: 'STORAGE_NEAR_LIMIT', tipo_recurso: 'almacenamiento', fecha_creacion: '2026-10-29', leida: true });
  await visit('/notificaciones', 'Tu bandeja');
  await waitFor("document.querySelectorAll('.notice-card').length === 3", 'notification cards');
  await select(0, 'plans');
  await waitFor("document.querySelectorAll('.notice-card').length === 1", 'notification topic filter');
  assert.ok(await evaluate("document.querySelector('.notice-card').textContent.includes('Pago aprobado')"));
  await select(0, 'all'); await click('Sin leer');
  await waitFor("document.querySelectorAll('.notice-card').length === 2", 'unread tab');
  await click('Todas'); await waitFor("document.querySelectorAll('.notice-card').length === 3", 'all tab');
  await evaluate("document.querySelector('.notifications-search input').focus()");
  await send('Input.insertText', { text: 'almacenamiento' });
  await waitFor("document.querySelectorAll('.notice-card').length === 1", 'notification search');
  await evaluate("document.querySelector('[aria-label=\"Limpiar búsqueda de notificaciones\"]').click()");
  await waitFor("document.querySelectorAll('.notice-card').length === 3", 'reset notification search');
  const notificationsDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-notifications-desktop.png'), Buffer.from(notificationsDesktop.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.documentElement.dataset.theme='dark'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Notification inbox mobile has no overflow');
  const notificationsMobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-notifications-mobile.png'), Buffer.from(notificationsMobile.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.documentElement.dataset.theme='light'");
  await click('Detalle'); await waitFor(text('Detalle de notificación'), 'notification page detail');
  await click('Cerrar');
  notifications = notifications.filter(n=>n.id === 1); notifications[0].leida = false;
  await click('Actualizar'); await waitFor("document.querySelectorAll('.notice-card').length === 1", 'reset notification fixtures');
  await click('Marcar leída'); await waitFor(text('Leída'), 'read notification');
  await evaluate("document.querySelector('[aria-label^=\"Eliminar aviso\"]').click()"); await click('Eliminar'); await waitFor(text('No tienes notificaciones'), '204 deletion');
  failCurrent = true; await visit('/plan', 'No se pudo consultar la suscripción');
  assert.equal(await evaluate("[...document.querySelectorAll('button')].filter(b=>['Elegir plan','Renovar plan'].includes(b.textContent.trim())).every(b=>b.disabled)"), true, 'Do not permit checkout when current subscription failed');
  failCurrent = false;
  Object.assign(current, { price: 0, planId: 1, planName: 'Free' });
  await visit('/plan', 'Incluido con tu cuenta'); await click('Elegir plan'); await select(0, '1'); await click('Confirmar operación'); await waitFor(text('Operación completada.'), 'new subscription');
  assert.ok(requests.some(r => r.path === '/subscriptions/subscribe' && r.body.planId === 2));
  Object.assign(current, { price: 29, planId: 2, planName: 'Básico' });
  await visit('/archivos', 'Mis Archivos');
  await waitFor("document.querySelectorAll('.mf-table tbody tr').length === 3", 'file library');
  assert.ok(await evaluate("!!document.querySelector('.mf-library-storage-track[role=progressbar]')"));
  await click('Carpetas'); await waitFor("document.querySelectorAll('.mf-table tbody tr').length === 1", 'file folder tab');
  await click('Todos'); await waitFor("document.querySelectorAll('.mf-table tbody tr').length === 3", 'all files');
  await evaluate("document.querySelector('[aria-label=\"Buscar archivos\"]').focus()"); await send('Input.insertText', { text: 'Informe' });
  await waitFor("document.querySelectorAll('.mf-table tbody tr').length === 1", 'file search');
  await evaluate("document.querySelector('[aria-label=\"Limpiar búsqueda de archivos\"]').click()");
  await waitFor("document.querySelectorAll('.mf-table tbody tr').length === 3", 'reset file search');
  await evaluate("document.querySelector('[aria-label=\"Agregar a favoritos: Informe.pdf\"]').click()");
  await waitFor("document.querySelector('[aria-label=\"Quitar de favoritos: Informe.pdf\"]')?.getAttribute('aria-pressed') === 'true'", 'favorite own file');
  const filesDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-files-desktop.png'), Buffer.from(filesDesktop.data, 'base64'));
  await evaluate("document.querySelector('[aria-label=\"Ver en cuadrícula\"]').click()");
  assert.ok(await evaluate("!!document.querySelector('.mf-grid-view')"));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.documentElement.dataset.theme='dark'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'File library grid mobile has no overflow');
  const filesMobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-files-mobile.png'), Buffer.from(filesMobile.data, 'base64'));
  await evaluate("document.querySelector('[aria-label=\"Ver en lista\"]').click()");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'File library list mobile has no overflow');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.documentElement.dataset.theme='light'");
  await click('Documentos'); await waitFor(text('Borrador.docx'), 'own folder navigation');
  await evaluate("document.querySelector('.mf-back-btn').click()"); await waitFor(text('Informe.pdf'), 'back to file root');
  await evaluate("document.querySelector('.mf-library-favorites').click()");
  await waitFor(text('Tus archivos favoritos'), 'favorite collection'); await waitFor(text('Informe.pdf'), 'favorite reference');
  await evaluate("document.querySelector('.mf-back-btn').click()"); await waitFor("!!document.querySelector('.mf-library-hero')", 'back from favorites');
  await evaluate("document.querySelector('[aria-label=\"Cambiar nombre de Informe.pdf\"]').click()");
  await waitFor(text('Cambiar nombre'), 'rename file dialog');
  await evaluate("document.querySelector('[role=dialog] input').focus();document.querySelector('[role=dialog] input').select()");
  await send('Input.insertText', { text: 'Informe final.pdf' }); await click('Guardar cambios');
  await waitFor(text('Informe final.pdf'), 'renamed file');
  assert.ok(requests.some(r=>r.path === '/files/52/rename' && r.body.name === 'Informe final.pdf'));
  await click('Crear carpeta'); await waitFor("!!document.querySelector('[role=dialog][aria-label=\"Crear carpeta\"]')", 'create folder dialog');
  await click('Cancelar');
  await click('Subir archivo'); await waitFor("!!document.querySelector('[role=dialog][aria-label=\"Subir archivos\"]')", 'upload modal'); await click('Cancelar');
  await visit('/papelera', 'documento.pdf');
  await waitFor("document.querySelectorAll('.mf-table tbody tr').length === 3", 'trash contents');
  assert.equal(await evaluate("[...document.querySelectorAll('.mf-table tbody tr')].find(row=>row.textContent.includes('Recuerdos')).querySelector('.mf-trash-delete-btn') === null"), true, 'Folders have restore but no permanent delete action');
  const trashDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-trash-desktop.png'), Buffer.from(trashDesktop.data, 'base64'));
  await evaluate("document.querySelector('[aria-label=\"Ver en cuadrícula\"]').click()");
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.documentElement.dataset.theme='dark'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Trash mobile grid has no overflow');
  const trashMobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-trash-mobile.png'), Buffer.from(trashMobile.data, 'base64'));
  await evaluate("document.querySelector('[aria-label=\"Ver en lista\"]').click()");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Trash mobile list has no overflow');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.documentElement.dataset.theme='light'");
  await evaluate("[...document.querySelectorAll('.mf-table tbody tr')].find(row=>row.textContent.includes('Imagen anterior.png')).querySelector('.mf-restore-btn').click()");
  await waitFor("![...document.querySelectorAll('.mf-table tbody tr')].some(row=>row.textContent.includes('Imagen anterior.png'))", 'restored trash file');
  assert.ok(requests.some(r=>r.path === '/files/2/restore' && r.method === 'PATCH'));
  await evaluate("[...document.querySelectorAll('.mf-table tbody tr')].find(row=>row.textContent.includes('Recuerdos')).querySelector('.mf-restore-btn').click()");
  await waitFor("![...document.querySelectorAll('.mf-table tbody tr')].some(row=>row.textContent.includes('Recuerdos'))", 'restored trash folder');
  assert.ok(requests.some(r=>r.path === '/folders/71/restore' && r.method === 'PATCH'));

  await evaluate("document.querySelector('[aria-label=\"Eliminar permanentemente documento.pdf\"]').click()");
  await waitFor(text('Esta acción no se puede deshacer.'), 'permanent deletion confirmation');
  assert.equal(requests.some(r=>r.path === '/files/1/permanent'), false, 'Opening confirmation must not delete');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.file-permanent-submit')).backgroundColor"), 'rgb(220, 38, 38)');
  await click('Cancelar');
  assert.equal(requests.some(r=>r.path === '/files/1/permanent'), false, 'Cancelling confirmation must not delete');
  await evaluate("document.querySelector('[aria-label=\"Eliminar permanentemente documento.pdf\"]').click()");
  await waitFor(text('Este cambio es definitivo'), 'permanent deletion warning');
  await evaluate("new Promise(resolve=>setTimeout(resolve,200))");
  const deleteDialog = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-trash-confirmation.png'), Buffer.from(deleteDialog.data, 'base64'));

  await click('Eliminar permanentemente'); await waitFor(text('eliminado permanentemente.'), 'deleted file');
  assert.ok(requests.some(r=>r.path === '/files/1/permanent' && r.method === 'DELETE'));
  await visit('/soporte', 'Centro de ayuda');
  await evaluate("document.querySelector('.support-search input').focus()");
  await send('Input.insertText', { text: 'contraseña' });
  await waitFor("document.querySelectorAll('.support-question').length === 1", 'support search');
  await evaluate("document.querySelector('.support-question summary').click()");
  assert.equal(await evaluate("document.querySelector('.support-question').open"), true, 'FAQ expands');
  await evaluate("document.querySelector('[aria-label=\"Limpiar búsqueda\"]').click()");
  await click('Liberar espacio');
  await waitFor("document.querySelectorAll('.support-question').length === 2", 'support category');
  assert.equal(await evaluate("document.querySelector('.support-topic.selected strong').textContent"), 'Planes y espacio');
  await evaluate("document.querySelector('.support-text-button').click()");
  await waitFor("document.querySelectorAll('.support-question').length === 12", 'reset support filters');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.documentElement.dataset.theme='light'");
  const supportDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-support-desktop.png'), Buffer.from(supportDesktop.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.documentElement.dataset.theme='dark'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Support mobile has no overflow');
  const supportMobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-support-mobile.png'), Buffer.from(supportMobile.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  await visit('/perfil', 'Información personal');
  await waitFor("!!document.querySelector('.account-storage-metrics')", 'profile storage');
  assert.ok(await evaluate("document.querySelector('#account-hero-title').textContent.includes('Cuenta')"));
  await evaluate("document.querySelector('input[name=firstName]').focus();document.querySelector('input[name=firstName]').select()");
  await send('Input.insertText', { text: 'Cuenta Editada' }); await click('Guardar cambios');
  await waitFor(text('Perfil actualizado'), 'save profile');
  assert.ok(requests.some(r=>r.path === '/users/me' && r.method === 'PATCH' && r.body.nombre === 'Cuenta Editada'));
  const profileDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-profile-desktop.png'), Buffer.from(profileDesktop.data, 'base64'));
  await evaluate("document.querySelector('.profileTabs [aria-label=Seguridad]').click()");
  await waitFor(text('Sesiones registradas'), 'security tab');
  const demoPassword = 'Example-New-123!';
  for (const [index, value] of [[0, 'Example-Old-123!'], [1, demoPassword], [2, demoPassword]]) {
    await evaluate(`document.querySelectorAll('.sec-form input')[${index}].focus()`);
    await send('Input.insertText', { text: value });
  }
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Requisitos de la contraseña cumplidos\"]').getAttribute('aria-valuenow')"), '5');
  await click('Actualizar contraseña'); await waitFor(text('Contraseña actualizada correctamente.'), 'change password');
  assert.ok(requests.some(r=>r.path === '/users/me/password' && r.method === 'PATCH' && r.body.newPassword === demoPassword));
  assert.equal(await evaluate("document.querySelectorAll('.sec-form input')[1].value"), '', 'Clear password after success');
  await click('Cerrar otras sesiones'); await waitFor("document.querySelectorAll('.sec-session-item').length === 1", 'close other sessions');
  assert.ok(requests.some(r=>r.path === '/users/me/logout-others' && r.method === 'POST'));
  const securityDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-profile-security.png'), Buffer.from(securityDesktop.data, 'base64'));
  await evaluate("document.querySelector('.profileTabs [aria-label=Preferencias]').click()");
  await waitFor(text('Interfaz y región'), 'preferences tab');
  await evaluate("document.querySelector('[role=switch][aria-label=\"Avisos de almacenamiento\"]').click()");
  await click('Oscuro');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark', 'Theme preview');
  await click('Guardar preferencias'); await waitFor(text('Preferencias guardadas correctamente.'), 'saved preferences');
  assert.ok(requests.some(r=>r.path === '/users/me/preferences' && r.method === 'PATCH' && r.body.theme === 'oscuro' && r.body.notifications.some(n=>n.id === 'storage' && n.enabled)));
  const preferencesDesktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-profile-preferences.png'), Buffer.from(preferencesDesktop.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Profile preferences mobile has no overflow');
  const preferencesMobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-profile-mobile.png'), Buffer.from(preferencesMobile.data, 'base64'));
  await evaluate("document.querySelector('.profileTabs [aria-label=Seguridad]').click()");
  await waitFor(text('Cambiar contraseña'), 'mobile security');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Security mobile has no overflow');
  await evaluate("document.querySelector('.profileTabs [aria-label=Perfil]').click()");
  await waitFor(text('Información personal'), 'mobile personal details');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Personal profile mobile has no overflow');
  await click('Desactivar cuenta'); await waitFor(text('Confirma con tu contraseña actual'), 'deactivation confirmation');
  assert.equal(requests.some(r=>r.path === '/users/me/deactivate'), false, 'Opening deactivation must not deactivate');
  await click('Cancelar'); assert.equal(requests.some(r=>r.path === '/users/me/deactivate'), false, 'Cancelling deactivation must not deactivate');
  await evaluate("document.querySelector('.profileTabs [aria-label=Preferencias]').click()"); await waitFor(text('Interfaz y región'), 'restore preferences');
  await click('Claro'); await click('Guardar preferencias'); await waitFor("document.documentElement.dataset.theme === 'light'", 'restore light theme');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  for (const [route, title, count] of [['/terminos', 'Términos y condiciones', 10], ['/privacidad', 'Política de privacidad', 10], ['/cookies', 'Política de cookies', 8]]) {
    await visit(route, title);
    await waitFor(`document.querySelectorAll('.legal-section').length === ${count}`, 'legal sections');
    assert.equal(await evaluate("document.querySelectorAll('.legal-index li').length"), count);
    assert.ok(await evaluate("document.querySelector('.legal-metadata').textContent.includes('6 de octubre de 2026')"), 'Preserve publication date');
    await evaluate("document.querySelectorAll('.legal-index a')[2].click()");
    await waitFor("location.hash.endsWith('section-3')", 'legal index navigation');
    await evaluate("document.querySelector('.legal-document-footer a').click()");
    if (route === '/privacidad') {
      await evaluate("document.documentElement.dataset.theme='light';window.scrollTo(0,0)");
      const legalDesktop = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(tmpdir(), 'cloudbox-legal-desktop.png'), Buffer.from(legalDesktop.data, 'base64'));
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await evaluate("document.documentElement.dataset.theme='dark'");
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Legal mobile has no overflow');
      const legalMobile = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(tmpdir(), 'cloudbox-legal-mobile.png'), Buffer.from(legalMobile.data, 'base64'));
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    }
  }
  admin = true;
  await visit('/admin/planes', 'Tu catálogo de planes'); await waitFor(text('Inactivo'), 'inactive admin plan');
  await click('Activar'); await click('Confirmar'); await waitFor(text('Plan actualizado'), 'activate plan');
  assert.ok(requests.some(r => r.path === '/plans/3/status' && r.body.id_estado === 1));
  await click('Crear plan');
  const fields = ['Empresas', 'Espacio para equipos', '199', '200', '30'];
  for (let i=0;i<fields.length;i++) {
    await evaluate(`(()=>{const e=document.querySelectorAll('[role=dialog] input')[${i}];e.focus();e.select();})()`);
    await send('Input.insertText', { text: fields[i] });
  }
  assert.equal(await evaluate("document.activeElement === document.querySelectorAll('[role=dialog] input')[4]"), true, 'Modal retains input focus while editing');
  await click('Guardar plan'); await waitFor(text('Empresas'), 'created plan');
  assert.ok(requests.some(r=>r.path === '/plans' && r.method === 'POST' && r.body.precio === 199 && r.body.espacio_maximo_gb === 200));
  await evaluate("[...document.querySelectorAll('article.ap-plan')].find(r=>r.textContent.includes('Básico')).querySelector('button').click()");
  await waitFor("!!document.querySelector('[role=dialog] input')", 'edit form');
  await evaluate("const input=document.querySelectorAll('[role=dialog] input')[1];input.focus();input.select();");
  await send('Input.insertText', { text: 'Descripción actualizada' });
  await click('Guardar plan'); await waitFor("!document.querySelector('[role=dialog]')", 'saved plan');
  assert.ok(requests.some(r=>r.path === '/plans/2' && r.method === 'PUT' && r.body.descripcion === 'Descripción actualizada'));

  await visit('/admin/suscripciones', 'Suscripciones');
  await visit('/admin/almacenamiento', 'Consumo por usuario'); await select(0, 'over'); await waitFor(text('No hay usuarios sobre cuota'), 'over quota filter');
  await visit('/admin/metricas', 'Métricas y reportes'); await waitFor("document.body.innerText.toLowerCase().includes('pdf')", 'object distribution');
  await click('CSV'); await waitFor("![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='CSV').disabled", 'CSV download');
  assert.ok(requests.some(r=>r.path === '/admin/reports/export' && r.search.includes('format=csv')));
  await click('PDF'); await waitFor("![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='PDF').disabled", 'PDF export');
  assert.ok(requests.some(r=>r.path === '/admin/reports/export' && r.search.includes('format=pdf')));
  await select(0, 'storage'); await click('Consultar'); await waitFor(text('Almacenamiento por estado'), 'storage report');
  await select(0, 'revenue'); await click('Consultar'); await waitFor(text('Ingresos por mes'), 'revenue report');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.documentElement.dataset.theme='dark'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'No mobile document overflow');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const screenshotPath = join(tmpdir(), 'cloudbox-modules-mobile.png');
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await visit('/admin/planes', 'Tu catálogo de planes');
  await waitFor(text('Pro'), 'desktop catalog');
  const desktop = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'cloudbox-modules-desktop.png'), Buffer.from(desktop.data, 'base64'));
  // Actual login/logout transitions, including preferences cleanup and a failed read for B.
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: authInit.identifier });
  admin = false;
  await visit('/perfil?tab=preferencias', 'Interfaz y región');
  await click('Oscuro'); await click('Guardar preferencias');
  await waitFor("document.documentElement.dataset.theme === 'dark' && JSON.parse(localStorage.getItem('cloudbox:preferences:1')).theme === 'oscuro'", 'save dark for account A');
  await click('Cerrar sesión');
  await waitFor("location.pathname === '/login' && !!document.querySelector('#email')", 'logout from preferences');
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light', 'Old preference cleanup cannot darken login');
  const loginAs = async email => {
    for (const [id, value] of [['email', email], ['password', 'Example-Test-123!']]) {
      await evaluate(`document.getElementById(${JSON.stringify(id)}).focus();document.getElementById(${JSON.stringify(id)}).select()`);
      await send('Input.insertText', { text: value });
    }
    await click('Iniciar sesión');
    await waitFor("location.pathname === '/dashboard' && !!document.querySelector('.app-user-name')", 'login dashboard');
  };
  failPreferencesB = true;
  await loginAs('b@example.invalid');
  await waitFor("JSON.parse(localStorage.getItem('user')).id === 2", 'account B identity');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light', 'B must not inherit A when its preferences request fails');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('cloudbox:preferences:1')).theme"), 'oscuro', 'A cache preserved');
  failPreferencesB = false;
  await visit('/perfil?tab=preferencias', 'Interfaz y región');
  await click('Claro'); await click('Guardar preferencias');
  await waitFor("JSON.parse(localStorage.getItem('cloudbox:preferences:2'))?.theme === 'claro'", 'save light for account B');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('cloudbox:preferences:1')).theme"), 'oscuro', 'Saving B does not modify A');
  await click('Cerrar sesión'); await waitFor("location.pathname === '/login' && !!document.querySelector('#email')", 'logout B');
  await loginAs('a@example.invalid');
  await waitFor("document.documentElement.dataset.theme === 'dark'", 'return to A dark theme');
  await send('Page.reload');
  await waitFor("!!document.querySelector('.app-user-name') && document.documentElement.dataset.theme === 'dark'", 'A persists after reload');
  await visit('/perfil?tab=preferencias', 'Interfaz y región');
  // Simulate the storage event received when another tab logs into B.
  await evaluate("localStorage.setItem('token','ui-test-b');localStorage.setItem('refreshToken','ui-refresh-b');localStorage.setItem('user',JSON.stringify({id:2}));window.dispatchEvent(new StorageEvent('storage',{key:'token'}))");
  await waitFor("document.querySelector('#account-hero-title')?.textContent.includes('Cuenta B') && document.documentElement.dataset.theme === 'light'", 'cross-tab account switch');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('cloudbox:preferences:1')).theme"), 'oscuro');
  await click('Cerrar sesión'); await waitFor("location.pathname === '/login'", 'final test logout');
  await send('Page.navigate', { url: origin + '/cookies' });
  await waitFor("document.querySelectorAll('.legal-section').length === 8", 'public legal page without session');
  assert.ok(await evaluate("!!document.querySelector('.landing-nav') && !document.querySelector('.app-topbar')"));
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light', 'Logged-out legal pages have no previous account theme');
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.legal-page')).backgroundColor"), 'rgb(255, 255, 255)');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.legal-sidebar')).display"), 'none');
  assert.equal(await evaluate("document.querySelectorAll('.legal-section').length"), 8, 'Print preserves every legal section');
  await send('Emulation.setEmulatedMedia', { media: '' });

  for (const [route, title, count] of [['/sobre-nosotros', 'Menos desorden.', 3], ['/caracteristicas', 'Todo lo que guardas.', 6], ['/seguridad', 'Tu espacio personal.', 6]]) {
    await visit(route, title);
    assert.equal(await evaluate("document.querySelectorAll('.product-card').length"), count);
    assert.ok(await evaluate("!!document.querySelector('.landing-nav')"));
    for (const theme of ['light', 'dark']) {
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `${route} ${theme} mobile overflow`);
    }
    await send('Emulation.setDeviceMetricsOverride', { width:1440, height:1000, deviceScaleFactor:1, mobile:false });
    await evaluate("document.documentElement.dataset.theme='light';window.scrollTo(0,0)");
    const shot = await send('Page.captureScreenshot', { format:'png' });
    await writeFile(join(tmpdir(), `cloudbox-product-${route.slice(1)}.png`), Buffer.from(shot.data,'base64'));
  }
  await visit('/nosotros', 'Menos desorden.');
  assert.equal(await evaluate('location.pathname'), '/sobre-nosotros', 'Footer alias resolves');
  await visit('/planes', 'Un plan para cada espacio');
  await waitFor("document.querySelectorAll('.plans-option').length > 0", 'public backend catalog');
  assert.ok(await evaluate("!!document.querySelector('.landing-nav') && !!document.querySelector('.plans-public-hero')"));
  assert.equal(await evaluate("document.querySelectorAll('.plans-public-faq details').length"),4);
  await evaluate("document.querySelector('.plans-public-faq summary').click()");
  assert.ok(await evaluate("document.querySelector('.plans-public-faq details').open"));
  const catalogShot = await send('Page.captureScreenshot',{format:'png'});
  await writeFile(join(tmpdir(),'cloudbox-public-plans.png'),Buffer.from(catalogShot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Public catalog mobile overflow');
  await evaluate("document.querySelector('.plans-option button').click()");
  await waitFor("location.pathname === '/registro'",'public plan signup CTA');
  await evaluate("localStorage.setItem('token','ui-test-only');localStorage.setItem('user',JSON.stringify({id:1}))");
  backendDelay = 400;
  for (const route of ['/dashboard','/archivos','/compartidos','/papelera','/perfil','/plan','/pagos','/actividad','/notificaciones']) {
    await send('Page.navigate',{url:origin+route});
    await waitFor("!!document.querySelector('.loading-arrows')",`${route} shows shared arrow loading`);
    assert.equal(await evaluate("document.querySelectorAll('.loading-spinner,.cf-spinner,.upload-spinner').length"),0,'Old loaders removed');
    await waitFor("!document.querySelector('[aria-busy=\"true\"]')",`${route} finishes when backend settles`);
  }
  await visit('/sobre-nosotros','Menos desorden.');
  assert.ok(await evaluate("!!document.querySelector('.app-topbar') && !document.querySelector('.landing-nav')"),'Informational pages use authenticated navigation');
  backendDelay = 0;
  assert.deepEqual(exceptions, [], 'No uncaught React/runtime errors');
  console.log(`PASS: 23 routes, shared loading with delayed backend, product pages and two-account theme isolation; renewal, cancellation, rejected payment, receipt, activity filtering, notification read/delete, checkout failure guard, plan creation/editing/activation, permanent deletion confirmation, quota filtering, reports, mobile layout. ${requests.length} mocked API requests. Screenshots: ${screenshotPath}`);
} finally { socket.close(); }
