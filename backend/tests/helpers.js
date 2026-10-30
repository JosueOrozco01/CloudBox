const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, exports: module.exports, require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(path.resolve(__dirname, '../src', path.dirname(file), name)),
    process: { env: {} }, console: { error() {} }, Date, Number
  });
  return module.exports;
}
function database(tables) {
  const calls = [];
  let failure = null;
  const keys=new Set();
  return { calls, async rpc(name,p) {
    if (failure) return {data:null,error:failure};
    if(name!=='cloudbox_notification_create_v1')throw new Error('Unexpected RPC '+name);
    const key=JSON.stringify([p.p_user_id,p.p_type,p.p_key]);
    if(p.p_key && keys.has(key))return {data:null,error:null};
    const rows=tables.notificacion||(tables.notificacion=[]);
    const data={id:Math.max(0,...rows.map(r=>r.id))+1,id_usuario:p.p_user_id,tipo:p.p_type,titulo:p.p_title,mensaje:p.p_message,
      tipo_recurso:p.p_resource_type,id_recurso:p.p_resource_id,fecha_creacion:new Date().toISOString().slice(0,10),leida:false,fecha_lectura:null};
    rows.push(data);if(p.p_key)keys.add(key);return {data,error:null};
  }, fail(error) { failure = error; }, from(table) {
    let filters = [], operation = 'select', values, start = 0, end = Infinity, orders = [], single = false, countMode = false;
    const q = {
      select() { return q; }, insert(v) { operation = 'insert'; values = v; return q; },
      update(v, options = {}) { operation = 'update'; values = v; countMode = options.count === 'exact'; return q; }, delete() { operation = 'delete'; return q; },
      eq(k,v) { calls.push(['eq',k,v]); filters.push(r => (k === 'accion.nombre' ? r.accion?.nombre : r[k]) == v); return q; },
      is(k,v) { filters.push(r => r[k] === v); return q; },
      gte(k,v) { filters.push(r => r[k] >= v); return q; }, lt(k,v) { filters.push(r => r[k] < v); return q; },
      order(k) { orders.push(k); return q; }, range(a,b) { start=a;end=b;return q; },
      single() { single=true;return q; }, maybeSingle() { single=true;return q; },
      then(resolve,reject) { return Promise.resolve().then(() => {
        if (failure) return { data:null,error:failure };
        let rows = tables[table] || (tables[table] = []);
        if (operation === 'insert') {
          const entries = Array.isArray(values) ? values : [values];
          if (entries.some(v => v.clave_deduplicacion && rows.some(r => r.id_usuario === v.id_usuario && r.tipo === v.tipo && r.clave_deduplicacion === v.clave_deduplicacion))) return {data:null,error:{code:'23505'}};
          const added = entries.map(v => ({id:rows.length+1,fecha_creacion:new Date().toISOString(),fecha_lectura:null,...v})); rows.push(...added); return {data:single?added[0]:added,error:null};
        }
        let selected = rows.filter(r => filters.every(f => f(r)));
        if (operation === 'update') selected.forEach(r => Object.assign(r,values));
        if (operation === 'delete') tables[table] = rows.filter(r => !selected.includes(r));
        selected.sort((a,b) => { for (const k of orders) { if(a[k]!==b[k]) return a[k]<b[k]?1:-1; } return 0; });
        const count = countMode ? selected.length : null;
        selected=selected.slice(start,end+1);
        return {data:countMode ? null : single?(selected[0]||null):selected,count,error:null};
      }).then(resolve,reject); }
    }; return q;
  }};
}
module.exports = { load, database };
