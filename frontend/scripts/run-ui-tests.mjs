import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
const temporaryRoot = await realpath(tmpdir());
const profile = await mkdtemp(join(temporaryRoot, 'cloudbox-browser-'));
let server, context;
try {
  await build({logLevel:'warn'});
  server = await preview({ preview: { host: '127.0.0.1', port: 5178, strictPort: true } });
  context = await chromium.launchPersistentContext(profile, {
    headless: true, args: ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0']
  });
  const [debugPort] = (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/);
  if (!/^\d+$/.test(debugPort)) throw new Error('No se pudo identificar el navegador de prueba.');
  const child = spawn(process.execPath, ['scripts/modules-ui.test.mjs'], {
    stdio: 'inherit', env: {...process.env,UI_TEST_BROWSER:`http://127.0.0.1:${debugPort}`}
  });
  process.exitCode = await new Promise((resolve,reject) => { child.once('error',reject); child.once('exit',code=>resolve(code ?? 1)); });
} finally {
  await context?.close();
  if (server) await new Promise(resolve=>server.httpServer.close(resolve));
  if (dirname(profile) !== temporaryRoot || !basename(profile).startsWith('cloudbox-browser-')) throw new Error('Directorio temporal no válido.');
  await rm(profile, { recursive: true, force: true });
}
