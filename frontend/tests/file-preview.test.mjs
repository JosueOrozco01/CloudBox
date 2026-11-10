import test from 'node:test';
import assert from 'node:assert/strict';
import { previewKind, fileExtension, downloadFile, readPreviewBody } from '../src/utils/filePreview.js';
import { getPageGuide } from '../src/components/PageGuide/guideContent.js';

test('preview selects a renderer from the actual extension, including uppercase names', () => {
  for (const [name, kind] of [['reporte.PDF', 'pdf'], ['foto.png', 'image'], ['video.webm', 'video'], ['audio.mp3', 'audio'], ['datos.JSON', 'text'], ['pagina.html', 'text'], ['informe.docx', 'document'], ['presupuesto.XLSX', 'spreadsheet'], ['anterior.xls', 'spreadsheet'], ['hoja.ods', 'spreadsheet'], ['archivo.zip', 'unsupported'], ['sin_extension', 'unsupported'], ['archivo.pdf.exe', 'unsupported']]) {
    assert.equal(previewKind(name), kind, name);
  }
  assert.equal(fileExtension('informe.final.DOCX'), 'docx');
});

test('profile tabs and favorites show their own guide', () => {
  assert.equal(getPageGuide('/perfil', '?tab=seguridad').title, 'Seguridad');
  assert.equal(getPageGuide('/perfil', '?tab=preferencias').title, 'Preferencias');
  assert.equal(getPageGuide('/perfil', '?tab=invalid').title, 'Mi perfil');
  assert.equal(getPageGuide('/archivos', '?favorites=1').title, 'Mis favoritos');
  assert.equal(getPageGuide('/admin/reportes').title, 'Métricas y reportes');
});

test('preview limits reject oversized streams even without Content-Length', async () => {
  const response = new Response('small file');
  assert.equal(await (await readPreviewBody(response, 100)).text(), 'small file');
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(6)); controller.enqueue(new Uint8Array(6)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readPreviewBody(new Response(stream), 10), /límite de vista previa/);
  assert.equal(cancelled, true);
  await assert.rejects(readPreviewBody(new Response('data', { headers: { 'content-length': '200' } }), 100), /límite de vista previa/);
});

test('download uses a fresh authorized URL and preserves the original filename', async () => {
  const original = { fetch: globalThis.fetch, document: globalThis.document, setTimeout: globalThis.setTimeout, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let clicked = false, removed = false, appended = false, authorized = 0, revoked;
  const link = { click() { clicked = true; }, remove() { removed = true; } };
  try {
    globalThis.document = { createElement: () => link, body: { append() { appended = true; } } };
    globalThis.fetch = async url => { assert.equal(url, 'https://storage.test/authorized'); return new Response('original bytes'); };
    URL.createObjectURL = () => 'blob:original';
    URL.revokeObjectURL = url => { revoked = url; };
    globalThis.setTimeout = callback => callback();
    await downloadFile(async () => { authorized++; return { name: 'Informe final.docx', url: 'https://storage.test/authorized' }; }, 'old.docx');
    assert.equal(authorized, 1);
    assert.equal(link.download, 'Informe final.docx');
    assert.equal(link.href, 'blob:original');
    assert.ok(clicked && appended && removed);
    assert.equal(revoked, 'blob:original');
    globalThis.fetch = async () => new Response(null, { status: 403 });
    await assert.rejects(downloadFile(async () => ({ url: 'expired' }), 'a.txt'), /No se pudo descargar/);
  } finally {
    Object.assign(globalThis, { fetch: original.fetch, document: original.document, setTimeout: original.setTimeout });
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  }
});
