const { readdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = ['tests', 'scripts'].flatMap(folder => readdirSync(path.join(root, folder))
  .filter(name => name.endsWith('.test.js') && name !== 'get-auth-token.test.js')
  .map(name => path.join(root, folder, name)));
const sqlFiles = files.filter(file => file.endsWith('audit-database.test.js') || file.endsWith('plan-price-update.test.js'));
const unitFiles = files.filter(file => !sqlFiles.includes(file));
// PostgreSQL's WASM compiler has a larger memory peak; run it separately and
// use baseline compilation so the full suite also works on smaller machines.
let failed = false;
const unitResult = spawnSync(process.execPath, ['--test', '--test-concurrency=4', '--test-timeout=60000', ...unitFiles], {cwd:root,stdio:'inherit'});
if(unitResult.error) console.error(unitResult.error.message);
if(unitResult.status !== 0) failed=true;

// Each PGlite suite peaks in WASM memory; run separate processes sequentially
// so the previous isolate and its buffers are released before the next suite.
for (const file of sqlFiles) {
  const result = spawnSync(process.execPath, ['--wasm-lazy-compilation', '--liftoff-only', '--test', '--test-timeout=60000', file], {cwd:root,stdio:'inherit'});
  if(result.error) console.error(result.error.message);
  if(result.status !== 0) failed=true;
}
process.exitCode = failed ? 1 : 0;
