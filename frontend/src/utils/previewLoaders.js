import { previewKind } from './filePreview';

export function loadPreviewRenderer(kind) {
  if (kind === 'document') return import('docx-preview');
  if (kind === 'spreadsheet') return import('xlsx');
  return Promise.resolve(null);
}

export function preloadFilePreview(name) {
  // Warm code on pointer/focus intent, without authorizing a download or fetching a file.
  void import('../components/FilePreview/FilePreview').catch(() => {});
  void loadPreviewRenderer(previewKind(name)).catch(() => {});
}

export function prepareFilePreview(item, getUrl) {
  preloadFilePreview(item.name);
  const authorization = getUrl();
  // The modal handles failures when it mounts, including a failed code download.
  void authorization.catch(() => {});
  return { item, getUrl, source: authorization };
}
