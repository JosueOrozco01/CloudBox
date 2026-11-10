import { useEffect, useRef, useState } from 'react';
import { Download, FileWarning } from 'lucide-react';
import { Modal } from '../ModuleUI/ModuleUI';
import Loading from '../Loading/Loading';
import { downloadFile, fileExtension, previewKind } from '../../utils/filePreview';
import { loadPreviewRenderer } from '../../utils/previewLoaders';
import { getPreviewBody } from '../../services/previewBodyCache';
import './FilePreview.css';

const TEXT_LIMIT = 2 * 1024 * 1024;
const OFFICE_LIMIT = 20 * 1024 * 1024;
export default function FilePreview({ item, getUrl, source, onClose }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [sheet, setSheet] = useState(0);
  const documentRef = useRef(null);
  const kind = previewKind(item.name);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (kind === 'unsupported') { setContent({ unsupported: true }); return; }
      const renderer = loadPreviewRenderer(kind);
      void renderer.catch(() => {});
      const result = await (source || getUrl());
      if (controller.signal.aborted) return;
      // Stream large media directly; text and office formats are parsed locally.
      if (['image', 'video', 'audio', 'pdf'].includes(kind)) {
        setContent({ url: result.url });
        return;
      }
      const body = await getPreviewBody(item, result, kind === 'text' ? TEXT_LIMIT : OFFICE_LIMIT, controller.signal);
      if (kind === 'text') {
        const text = await body.text();
        if (!controller.signal.aborted) setContent({ text });
      } else {
        const buffer = await body.arrayBuffer();
        if (controller.signal.aborted) return;
        if (kind === 'document') {
          const { renderAsync } = await renderer;
          if (controller.signal.aborted) return;
          await renderAsync(buffer, documentRef.current, undefined, { breakPages: true, ignoreWidth: true, ignoreHeight: true, useBase64URL: true, renderAltChunks: false });
          if (!controller.signal.aborted) setContent({ document: true });
        } else {
          const XLSX = await renderer;
          if (controller.signal.aborted) return;
          const workbook = XLSX.read(buffer, { type: 'array', sheetRows: 501 });
          setContent({ sheets: workbook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false }).slice(0, 500).map(row => row.slice(0, 100)) })) });
        }
      }
    }
    load().catch(error => { if (!controller.signal.aborted) setError(error.message || 'No se puede mostrar este archivo. Puedes descargarlo para abrirlo.'); });
    return () => controller.abort();
  }, [getUrl, kind, item, source]);

  const mediaError = () => setError('El navegador no puede reproducir este formato o el enlace venció. Puedes descargarlo o cerrar y volver a abrir la vista previa.');
  return <div className="file-preview"><Modal title={item.name} subtitle={`Vista previa · ${fileExtension(item.name).toUpperCase() || 'Archivo'}`} onClose={onClose}>
    <div className="file-preview-actions"><button type="button" className="module-button" disabled={downloading} onClick={async () => { setDownloading(true); setDownloadError(''); try { await downloadFile(getUrl, item.name); } catch (error) { setDownloadError(error.message); } finally { setDownloading(false); } }}><Download size={16} />{downloading ? 'Descargando...' : 'Descargar original'}</button></div>
    {downloadError && <p role="alert">{downloadError}</p>}
    {!content && !error && <Loading inline text="Cargando vista previa" description="Estamos preparando tu archivo." />}
    {error && <p role="alert" className="file-preview-message">{error}</p>}
    {content?.unsupported && <div className="file-preview-message"><FileWarning size={32} /><p>Este formato ({fileExtension(item.name).toUpperCase() || 'sin extensión'}) necesita una aplicación compatible. Descarga el original para abrirlo conservando su formato.</p></div>}
    <div className="file-preview-content">
      {!error && content?.url && kind === 'image' && <img src={content.url} alt={item.name} onError={mediaError} />}
      {!error && content?.url && kind === 'pdf' && <object data={content.url} type="application/pdf" aria-label={item.name}><p>Tu navegador no incluye un visor PDF. Usa Descargar original.</p></object>}
      {!error && content?.url && kind === 'video' && <video src={content.url} controls preload="metadata" onError={mediaError} />}
      {!error && content?.url && kind === 'audio' && <audio src={content.url} controls preload="metadata" onError={mediaError} />}
      {content?.text !== undefined && <pre>{content.text}</pre>}
      {kind === 'document' && <div ref={documentRef} className="file-preview-document" />}
      {content?.sheets && <><label className="module-field">Hoja<select value={sheet} onChange={event => setSheet(Number(event.target.value))}>{content.sheets.map((sheet, index) => <option key={sheet.name} value={index}>{sheet.name}</option>)}</select></label><p className="module-muted">Vista de datos: hasta 500 filas y 100 columnas por hoja. Descarga el original para ver fórmulas, gráficos y formato completo.</p><div className="file-preview-sheet"><table><tbody>{content.sheets[sheet]?.rows.map((row, index) => <tr key={index}><th scope="row">{index + 1}</th>{row.map((value, column) => <td key={column}>{String(value)}</td>)}</tr>)}</tbody></table></div></>}
    </div>
  </Modal></div>;
}
