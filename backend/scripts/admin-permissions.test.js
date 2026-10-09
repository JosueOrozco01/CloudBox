const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let mutations = 0;
const service = {
  updateUserStatus: async () => { mutations += 1; },
  updateUserRole: async () => { mutations += 1; },
};
const context = {
  require: name => name.includes('admin.service') ? service : { recordLog: async () => {} },
  module: { exports: {} },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/admin.controller.js'), 'utf8'), context);
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
(async () => {
  for (const [action, body] of [['updateUserStatus', { id_estado: 2 }], ['updateUserRole', { id_rol: 1 }]]) {
    const res = response();
    await context.module.exports[action]({ params: { id: '5' }, user: { id: 5 }, body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(mutations, 0);
  }
  const res = response();
  await context.module.exports.updateUserStatus({ params: { id: '5invalid' }, user: { id: 1 }, body: { id_estado: 2 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(mutations, 0);
  console.log('OK: se bloquean cambios sobre la propia cuenta e identificadores inválidos.');
})().catch(error => { console.error(error); process.exitCode = 1; });
