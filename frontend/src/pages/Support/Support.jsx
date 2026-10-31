import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Bell, Check, ChevronDown, Cloud, CreditCard, FileText, FolderOpen, HardDrive, LifeBuoy, LockKeyhole, Search, Share2, ShieldCheck, Sparkles, X } from "lucide-react";
import { ModulePage } from "../../components/ModuleUI/ModuleUI";
import "./Support.css";

const topics = [
  { id: "files", title: "Archivos y carpetas", text: "Sube, organiza y recupera tus archivos.", icon: FolderOpen, color: "blue" },
  { id: "sharing", title: "Compartir archivos", text: "Comparte y controla quién tiene acceso.", icon: Share2, color: "violet" },
  { id: "storage", title: "Planes y espacio", text: "Encuentra espacio para lo que importa.", icon: HardDrive, color: "cyan" },
  { id: "payments", title: "Pagos y suscripciones", text: "Revisa tus pagos, vigencias y recibos.", icon: CreditCard, color: "amber" },
  { id: "security", title: "Cuenta y seguridad", text: "Mantén tu cuenta y tus archivos seguros.", icon: ShieldCheck, color: "green" },
  { id: "notifications", title: "Notificaciones", text: "Entiende tus avisos y tu actividad.", icon: Bell, color: "rose" },
];
const questions = [
  { topic: "files", title: "¿Cómo subo y organizo mis archivos?", answer: "En Mis Archivos, selecciona Subir archivos. Puedes crear carpetas para organizar tu espacio y usar las acciones de cada elemento para cambiar su nombre o moverlo a otra carpeta." },
  { topic: "files", title: "¿Puedo recuperar un archivo que eliminé?", answer: "Sí. Abre Papelera y selecciona Restaurar junto al archivo o carpeta. Los archivos eliminados permanentemente no se pueden recuperar desde CloudBox." },
  { topic: "sharing", title: "¿Cómo comparto un archivo o una carpeta?", answer: "En Compartidos, elige un recurso propio e indica el correo de una cuenta activa de CloudBox. Selecciona el permiso y, si lo necesitas, una fecha de vencimiento para el acceso." },
  { topic: "sharing", title: "¿Cómo dejo de compartir un archivo?", answer: "Abre Compartidos por mí y consulta la información del elemento. Desde allí puedes cambiar el permiso o revocar el acceso. Los enlaces de descarga ya emitidos pueden seguir siendo válidos hasta su vencimiento." },
  { topic: "storage", title: "¿Qué hago si mi almacenamiento está lleno?", answer: "Consulta tu espacio disponible en Mi Plan. Puedes liberar espacio eliminando permanentemente archivos de la papelera o elegir un plan con mayor capacidad. Los archivos que siguen en papelera también ocupan espacio." },
  { topic: "storage", title: "¿Cuándo se aplica un cambio de plan?", answer: "Una mejora puede aplicarse de inmediato con crédito proporcional por la vigencia restante. Un cambio a un plan menor se programa al finalizar la vigencia actual. La confirmación de la operación muestra su fecha efectiva y los créditos aplicados." },
  { topic: "payments", title: "¿Dónde encuentro mis comprobantes de pago?", answer: "En Pagos puedes consultar el historial y el detalle de cada operación. Los pagos aprobados permiten consultar su comprobante y descargarlo como PDF. Los pagos de CloudBox son simulados." },
  { topic: "payments", title: "¿Qué pasa si cancelo mi suscripción?", answer: "Conservas el servicio pagado hasta el final de su vigencia y después regresas a Free. Tus archivos se conservan. Si el uso supera la nueva capacidad, tendrás que liberar espacio o ampliar tu plan para seguir subiendo archivos." },
  { topic: "security", title: "¿Cómo cambio mi contraseña?", answer: "Abre Mi perfil y entra en Seguridad para cambiar tu contraseña. Si no puedes iniciar sesión, usa la opción ¿Olvidaste tu contraseña? en la pantalla de acceso." },
  { topic: "security", title: "¿Puedo cerrar mis otras sesiones?", answer: "Sí. En Mi perfil, dentro de Seguridad, puedes revisar los accesos registrados por CloudBox y cerrar las otras sesiones. Este historial muestra los accesos registrados por la aplicación." },
  { topic: "notifications", title: "¿Cómo marco mis notificaciones como leídas?", answer: "Abre la campana y selecciona un aviso para consultar su detalle. Puedes marcar todos como leídos desde la cabecera del desplegable o abrir la bandeja completa para consultar y eliminar avisos." },
  { topic: "notifications", title: "¿Dónde puedo ver mi actividad?", answer: "Abre Mi actividad desde el menú de tu cuenta. Puedes filtrar las acciones registradas por tipo y fechas. Un evento de descarga indica que el acceso fue autorizado, no que el navegador haya recibido el archivo completo." },
];
const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Support() {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState(null);
  const signedIn = Boolean(localStorage.getItem("token"));
  const selected = topics.find(item => item.id === topic);
  const filtered = questions.filter(item => (!topic || item.topic === topic) && normalize(`${item.title} ${item.answer}`).includes(normalize(search.trim())));
  const reset = () => { setSearch(""); setTopic(null); };

  return <ModulePage title="Centro de ayuda" description="Todo lo que necesitas para sentirte en casa en CloudBox." actions={<Link className="module-button" to={signedIn ? "/dashboard" : "/"}><ArrowLeft size={15} />Volver a inicio</Link>}>
    <div className="support-page">
      <section className="support-hero" aria-labelledby="support-hero-title">
        <div className="support-hero-content">
          <span className="support-eyebrow"><LifeBuoy size={15} />ESTAMOS PARA AYUDARTE</span>
          <h2 id="support-hero-title">Tu espacio en la nube.<br /><span>Las respuestas, aquí.</span></h2>
          <p>Encuentra una solución y sigue con lo importante.</p>
          <label className="support-search"><Search size={20} aria-hidden="true" /><span className="support-sr-only">Buscar en las preguntas frecuentes</span><input type="search" placeholder="¿En qué podemos ayudarte?" value={search} onChange={event => { setSearch(event.target.value); setTopic(null); }} />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch("")}><X size={17} /></button>}</label>
          <div className="support-popular"><span>Lo más consultado:</span><button type="button" onClick={() => { setTopic("storage"); setSearch(""); }}>Liberar espacio</button><button type="button" onClick={() => { setTopic("security"); setSearch(""); }}>Mi contraseña</button></div>
        </div>
        <div className="support-hero-art" aria-hidden="true"><div className="support-orbit support-orbit-outer" /><div className="support-orbit support-orbit-inner" /><div className="support-cloud"><Cloud size={82} strokeWidth={1.3} /><span><Check size={17} /></span></div><div className="support-floating support-floating-file"><FileText size={23} /></div><div className="support-floating support-floating-lock"><LockKeyhole size={22} /></div><span className="support-art-label"><span />Todo en su lugar</span></div>
      </section>

      <section aria-labelledby="support-topics-title"><div className="support-section-heading"><div><h2 id="support-topics-title">¿Por dónde empezamos?</h2><p>Explora un tema y encuentra justo lo que buscas.</p></div>{topic && <button className="support-text-button" onClick={reset}>Ver todos los temas<X size={14} /></button>}</div><div className="support-topics">{topics.map(({ id, title, text, icon: Icon, color }) => <button type="button" key={id} className={`support-topic ${topic === id ? "selected" : ""}`} aria-pressed={topic === id} onClick={() => { setTopic(topic === id ? null : id); setSearch(""); }}><span className={`support-topic-icon ${color}`}><Icon size={23} strokeWidth={1.7} /></span><span className="support-topic-copy"><strong>{title}</strong><span>{text}</span></span><ArrowUpRight size={17} className="support-topic-arrow" /></button>)}</div></section>

      <div className="support-bottom-grid">
        <section className="support-faq" aria-labelledby="support-faq-title"><div className="support-section-heading"><div><span className="support-kicker">UN POCO DE ORIENTACIÓN</span><h2 id="support-faq-title">{selected ? selected.title : "Preguntas frecuentes"}</h2></div><span className="support-result-count" role="status">{filtered.length} {filtered.length === 1 ? "respuesta" : "respuestas"}</span></div>{filtered.length ? <div className="support-questions">{filtered.map(item => <details key={`${topic}-${search}-${item.title}`} className="support-question"><summary>{item.title}<ChevronDown size={18} /></summary><p>{item.answer}</p></details>)}</div> : <div className="support-no-results"><Search size={28} /><h3>No encontramos esa respuesta</h3><p>Prueba con otra palabra, como “archivos”, “espacio” o “contraseña”.</p><button type="button" className="module-button" onClick={reset}>Ver todas las preguntas</button></div>}</section>
        <aside className="support-sidebar"><section className="support-shortcuts"><span className="support-sidebar-icon"><Sparkles size={21} /></span><h2>Un atajo a lo que necesitas</h2><p>Tu cuenta, tus preferencias y tu espacio, a un clic.</p><Link to={signedIn ? "/perfil?tab=seguridad" : "/recuperar"}><ShieldCheck size={18} /><span>Seguridad de mi cuenta</span><ArrowUpRight size={16} /></Link><Link to={signedIn ? "/plan" : "/planes"}><HardDrive size={18} /><span>Explorar planes y espacio</span><ArrowUpRight size={16} /></Link><Link to={signedIn ? "/notificaciones" : "/login"}><Bell size={18} /><span>Consultar mis notificaciones</span><ArrowUpRight size={16} /></Link></section><section className="support-privacy"><span><LockKeyhole size={18} />Tu tranquilidad importa</span><p>Conoce cómo cuidamos tu información y las condiciones de uso de tu espacio.</p><div><Link to="/privacidad">Privacidad<ArrowUpRight size={13} /></Link><Link to="/terminos">Términos de uso<ArrowUpRight size={13} /></Link></div></section></aside>
      </div>
      <div className="support-note"><LifeBuoy size={17} /><p>Este centro reúne guías de uso de CloudBox. La atención mediante tickets todavía no está disponible.</p></div>
    </div>
  </ModulePage>;
}
