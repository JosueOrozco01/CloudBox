const groups = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg'],
  video: ['mp4', 'webm', 'ogv', 'mov', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'],
  text: ['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'sql', 'log', 'yaml', 'yml', 'ini', 'sh'],
  pdf: ['pdf'],
  document: ['docx'],
  spreadsheet: ['xlsx', 'xls', 'ods'],
};
export function fileExtension(name = '') {
  return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
}
export function previewKind(name) {
  const extension = fileExtension(name);
  return Object.keys(groups).find(kind => groups[kind].includes(extension)) || 'unsupported';
}
export async function readPreviewBody(response, limit) {
  const tooLarge = () => new Error(`El archivo supera el límite de vista previa de ${limit / (1024 * 1024)} MB. Descárgalo para verlo completo.`);
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw tooLarge();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw tooLarge(); }
    chunks.push(value);
  }
  return new Blob(chunks);
}
export async function downloadFile(getUrl, name) {
  const result = await getUrl();
  const response = await fetch(result.url);
  if (!response.ok) throw new Error('No se pudo descargar el archivo. Inténtalo nuevamente.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = result.name || name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
