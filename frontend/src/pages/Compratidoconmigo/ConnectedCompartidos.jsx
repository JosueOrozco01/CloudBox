import { invalidateReadCache } from "../../services/readCache";
import { lazy, Suspense } from "react";
import { downloadFile } from "../../utils/filePreview";
import { prepareFilePreview } from '../../utils/previewLoaders';
import Loading from "../../components/Loading/Loading";
import RecipientPicker from "./RecipientPicker";
import { getFileFavorites, setItemFavorite, favoriteKey } from "../../services/favoriteService";
import { Share2, Users, Send, ArrowLeft, RefreshCw, Info, ShieldCheck, FolderOpen } from "lucide-react";
import SharedDialog from "./SharedDialog";
import AlertModal from "../../components/AlertModal/AlertModal";
import Footer from "../../components/FooterSignOut/Footer";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Compartidos from "./Compartidoconmigo";
import { request, getFolderLocations, getUserFiles } from "../../services/dashboardService";

const FilePreview = lazy(() => import("../../components/FilePreview/FilePreview"));

export default function ConnectedCompartidos() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [params, setParams] = useSearchParams();
  const folder = params.get("folder");
  const [favoriteKeys, setFavoriteKeys] = useState([]);
  const [favoriteAvailability, setFavoriteAvailability] = useState({});
  const [favoriteWarning, setFavoriteWarning] = useState("");
  const [favoritePending, setFavoritePending] = useState([]);
  const pendingFavorites = useRef(new Set());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [revision, setRevision] = useState(0);
  const [sent, setSent] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [source, setSource] = useState("");
  const [kind, setKind] = useState("files");
  const [resource, setResource] = useState("");
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("2");
  const [expiration, setExpiration] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const map = (resource, share, isFolder) => {
      const owner = sent ? share?.receptor : share?.emisor;
      const type = isFolder ? "carpeta" : resource.nombre.split(".").pop().toLowerCase();
      return { id: `${isFolder ? "folder" : "file"}-${resource.id}-${share?.id || "content"}`, rawId: resource.id, shareId: share?.id,
        name: resource.nombre, type, typeLabel: isFolder ? "Carpeta" : type.toUpperCase(),
        owner: owner ? [owner.nombre, owner.apellido].filter(Boolean).join(" ") || owner.correo : "Acceso por carpeta compartida",
        timestamp: share?.fecha_compartido, sharedOn: share?.fecha_compartido ? new Date(share.fecha_compartido).toLocaleDateString("es-GT") : "—",
        permission: share?.id_permiso === 0 ? "Propietario" : share?.id_permiso === 1 ? "Editor" : "Visualizador" };
    };
    async function load() {
      setLoading(true); setError(""); setDetail(null);
      try {
        const favoriteRequest = Promise.allSettled([getFileFavorites()]);
        favoriteRequest.then(favorites => {
          if (!active) return;
          setFavoriteKeys(favorites[0].status === "fulfilled" ? favorites[0].value.map(f => `file-${f.id_archivo}`) : []);
          setFavoriteAvailability({ files: favorites[0].status === "fulfilled", folders: false });
          setFavoriteWarning(favorites.filter(result => result.status === "rejected").map(result => result.reason.message).join(" "));
        });
        let rows;
        if (folder) {
          const content = await request(`/shares/folders/${folder}/content`);
          const inherited = { id_permiso: content.access.isOwner ? 0 : content.access.permissionId };
          rows = [...content.folders.map(r => map(r, inherited, true)), ...content.files.map(r => map(r, inherited, false))];
        } else {
          const shares = sent ? await request("/shares/sent") : (await Promise.all([request("/shares/received/files"), request("/shares/received/folders")])).flat();
          rows = shares.filter(s => (s.archivo || s.carpeta)?.id_estado === 1 && (!s.fecha_expiracion || new Date(s.fecha_expiracion) > new Date())).map(s => map(s.archivo || s.carpeta, s, !!s.carpeta));
        }
        if (active) setItems(rows);
      } catch (e) {
        if (active) { setItems([]); setError(e.message); if (e.status === 401) navigate("/login", { replace: true }); }
      } finally { if (active) setLoading(false); }
    }
    load(); return () => { active = false; };
  }, [folder, sent, revision, navigate]);
  async function toggleFavorite(item) {
    const key = favoriteKey(item);
    if (pendingFavorites.current.has(key)) return;
    pendingFavorites.current.add(key); setFavoritePending([...pendingFavorites.current]);
    const next = !favoriteKeys.includes(key);
    try {
      await setItemFavorite(item, next);
      setFavoriteKeys(keys => next ? [...new Set([...keys, key])] : keys.filter(value => value !== key));
      setNotice(next ? "Recurso agregado a Mis favoritos." : "Recurso eliminado de Mis favoritos.");
    } catch (e) { setError(e.message); }
    finally { pendingFavorites.current.delete(key); setFavoritePending([...pendingFavorites.current]); }
  }
  async function showShare() {
    setBusy(true); setError("");
    try {
      const [locations, ownFiles] = await Promise.all([getFolderLocations(), getUserFiles()]);
      setFolders(locations); setFiles(ownFiles); setSource(""); setResource(""); setSharing(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function changeSource(value) {
    setBusy(true); setSource(value); setResource("");
    try { setFiles(await getUserFiles(value || null)); }
    catch (e) { setFiles([]); setError(e.message); }
    finally { setBusy(false); }
  }
  async function createShare(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await request(`/shares/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiverEmail: email, [kind === "files" ? "fileId" : "folderId"]: Number(resource), permissionId: Number(permission), expiresAt: expiration ? new Date(expiration).toISOString() : null }) });
      setSharing(false); setSent(true); setParams({}); setRevision(r => r + 1);
      setNotice("Recurso compartido correctamente. El destinatario ya puede acceder.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function open(item, download = false) {
    setError("");
    if (item.type === "carpeta") { setParams({ folder: String(item.rawId) }); return; }
    const getUrl = () => request(`/shares/files/${item.rawId}/download-url`);
    if (!download) { setPreview(prepareFilePreview(item, getUrl)); return; }
    try {
      await downloadFile(getUrl, item.name);
    } catch (e) { setError(e.message); }
  }
  async function info(item) {
    try { setDetail(item.shareId ? await request(`/shares/${item.shareId}`) : { recurso: item.name, permiso: item.permission, acceso: "Heredado de la carpeta" }); }
    catch (e) { setError(e.message); }
  }
  async function mutate(path, body) {
    setBusy(true); setError("");
    try { await request(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); setRevision(r => r + 1); setDetail(null); setNotice(path.endsWith("/revoke") ? "Acceso revocado correctamente." : "Permiso actualizado correctamente."); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const formatDate = value => value ? new Date(value).toLocaleString("es-GT") : "Sin vencimiento";
  const detailName = detail?.archivo?.nombre || detail?.carpeta?.nombre || detail?.recurso;
  return <>
    {preview && <Suspense fallback={<Loading fullScreen={false} text="Cargando vista previa" />}><FilePreview item={preview.item} getUrl={preview.getUrl} source={preview.source} onClose={() => setPreview(null)} /></Suspense>}
    <div className="sc-page sc-navigation">
      <div className="sc-scope-tabs" aria-label="Vista de compartidos">
        <button className={!sent ? "active" : ""} aria-pressed={!sent} onClick={() => { setParams({}); setSent(false); }}><Users size={17} />Compartidos conmigo</button>
        <button className={sent ? "active" : ""} aria-pressed={sent} onClick={() => { setParams({}); setSent(true); }}><Send size={17} />Compartidos por mí</button>
      </div>
      <div className="sc-navigation-actions">
        <button className="sc-secondary" disabled={loading} onClick={() => { invalidateReadCache(); setRevision(r => r + 1); }}><RefreshCw size={16} className={loading ? "sc-spinning" : ""} />Actualizar</button>
        <button className="sc-primary" disabled={busy} onClick={showShare}><Share2 size={17} />Compartir</button>
      </div>
      {favoriteWarning && <p className="sc-favorite-warning" role="alert">{favoriteWarning}</p>}
      {folder && <div className="sc-folder-trail"><button onClick={() => setParams({})}><ArrowLeft size={16} />Volver a compartidos</button><span><FolderOpen size={16} />Contenido de carpeta compartida</span></div>}
      {error && !sharing && !detail && <div className="sc-feedback sc-feedback-error" role="alert"><Info size={18} /><span>{error}</span><button onClick={() => { invalidateReadCache(); setRevision(r => r + 1); }}>Reintentar</button></div>}
    </div>
    {loading ? <Loading /> : <Compartidos key={`${folder}-${sent}-${revision}`} favoriteKeys={favoriteKeys} favoritePending={favoritePending} favoriteAvailability={favoriteAvailability} onToggleFavorite={toggleFavorite} sent={sent} insideFolder={Boolean(folder)} items={items} totalCount={items.length} folderCount={items.filter(i => i.type === "carpeta").length} fileCount={items.filter(i => i.type !== "carpeta").length} sharedByCount={new Set(items.map(i => i.owner)).size} onOpenItem={open} onDownloadItem={item => open(item, true)} onItemInfo={info} />}
    {sharing && <SharedDialog title="Compartir recurso" subtitle="Colabora con otras personas de CloudBox" icon={Share2} busy={busy} onClose={() => setSharing(false)} onSubmit={createShare} footer={<><button className="cf-cancel-btn" type="button" disabled={busy} onClick={() => setSharing(false)}>Cancelar</button><button className="cf-create-btn" disabled={busy || !resource} type="submit"><Share2 size={16} />{busy ? "Compartiendo…" : "Compartir recurso"}</button></>}>
      {error && <div className="cf-error" role="alert">{error}</div>}
      <div className="sc-dialog-note"><ShieldCheck size={19} /><p>Tú decides quién tiene acceso. Puedes cambiar el permiso o revocarlo cuando lo necesites.</p></div>
      <label className="cf-field"><span>¿Qué deseas compartir?</span><select disabled={busy} value={kind} onChange={e => { setKind(e.target.value); setResource(""); }}><option value="files">Un archivo</option><option value="folders">Una carpeta</option></select></label>
      {kind === "files" && <label className="cf-field"><span>Ubicación del archivo</span><select disabled={busy} value={source} onChange={e => changeSource(e.target.value)}><option value="">Mis archivos (raíz)</option>{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      <label className="cf-field"><span>{kind === "files" ? "Archivo" : "Carpeta"}</span><select required disabled={busy} value={resource} onChange={e => setResource(e.target.value)}><option value="">Selecciona un recurso</option>{(kind === "files" ? files : folders).map(r => <option key={r.id} value={r.id}>{r.nombre || r.name}</option>)}</select></label>
      {!(kind === "files" ? files : folders).length && <p className="sc-field-help">No hay recursos en esta ubicación. Selecciona otra carpeta o sube un archivo desde Mis archivos.</p>}
      <RecipientPicker value={email} onChange={setEmail} disabled={busy} />
      <div className="sc-form-columns"><label className="cf-field"><span>Permiso de acceso</span><select disabled={busy} value={permission} onChange={e => setPermission(e.target.value)}><option value="2">Visualizador</option><option value="1">Editor</option></select></label>
      <label className="cf-field"><span>Vencimiento (opcional)</span><input disabled={busy} type="datetime-local" value={expiration} onChange={e => setExpiration(e.target.value)} /></label></div>
    </SharedDialog>}
    {detail && <SharedDialog title="Información del compartido" subtitle={detailName} icon={Info} busy={busy} onClose={() => setDetail(null)} footer={<button className="cf-create-btn" type="button" disabled={busy} onClick={() => setDetail(null)}>Listo</button>}>
      {error && <div className="cf-error" role="alert">{error}</div>}
      <div className="sc-resource-summary"><span className="cf-header-icon"><FolderOpen size={23} /></span><div><strong>{detailName}</strong><span>{detail.carpeta ? "Carpeta compartida" : "Recurso compartido"}</span></div><span className="sc-status">{detail.id_estado === 2 ? "Revocado" : detail.fecha_expiracion && new Date(detail.fecha_expiracion) <= new Date() ? "Vencido" : "Activo"}</span></div>
      <dl className="sc-detail-list">{Object.entries({ Emisor: detail.emisor?.correo, Destinatario: detail.receptor?.correo, Permiso: detail.permiso?.nombre || detail.permiso, "Compartido el": detail.fecha_compartido ? formatDate(detail.fecha_compartido) : null, Vencimiento: formatDate(detail.fecha_expiracion), Acceso: detail.acceso }).map(([key, value]) => value && <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      {sent && detail.id && <div className="sc-access-controls"><h3><ShieldCheck size={17} />Administrar acceso</h3><p>Los cambios se aplican al acceso de esta persona.</p><label className="cf-field"><span>Permiso actual</span><select disabled={busy} value={detail.id_permiso} onChange={e => mutate(`/shares/${detail.id}/permission`, { permissionId: Number(e.target.value) })}><option value={2}>Visualizador</option><option value={1}>Editor</option></select></label><button className="sc-danger" type="button" disabled={busy} onClick={() => mutate(`/shares/${detail.id}/revoke`, {})}>Revocar acceso</button></div>}
    </SharedDialog>}
    <AlertModal isOpen={!!notice} type="success" title="Cambio guardado" message={notice || ""} variant="toast" autoClose onClose={() => setNotice(null)} />
    <Footer />
  </>;
}
