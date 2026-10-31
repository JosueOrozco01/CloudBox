import { Link, NavLink } from "react-router-dom";
import { ArrowRight, ArrowUp, CalendarDays, Clock3, Cookie, FileText, LifeBuoy, Printer, ShieldCheck } from "lucide-react";
import Topbar from "../TopBarPrincipal/Topbarprincipal";
import Footer from "../FooterSignOut/Footer";
import "./LegalDocument.css";

const documents = [
  { id: 'terms', to: '/terminos', title: 'Términos y condiciones', short: 'Términos', icon: FileText },
  { id: 'privacy', to: '/privacidad', title: 'Política de privacidad', short: 'Privacidad', icon: ShieldCheck },
  { id: 'cookies', to: '/cookies', title: 'Política de cookies', short: 'Cookies', icon: Cookie },
];
export default function LegalDocument({ kind, intro, sections, embedded = false }) {
  const document = documents.find(item => item.id === kind);
  const Icon = document.icon;
  const minutes = Math.max(1, Math.ceil(sections.reduce((sum, section) => sum + section.content.split(/\s+/).length, 0) / 180));
  const cleanTitle = title => title.replace(/^\d+\.\s*/, '');
  return <div className="legal-page" id="legal-top">{!embedded && <Topbar />}<main className="legal-main"><div className="legal-page-heading"><div><span className="legal-kicker">INFORMACIÓN LEGAL</span><h1>{document.title}</h1><p>Conoce las reglas y políticas que acompañan tu espacio en CloudBox.</p></div><button type="button" className="legal-print" onClick={() => window.print()}><Printer size={15} />Imprimir</button></div>
    <section className="legal-hero" aria-label="Introducción al documento"><div><span className="legal-eyebrow"><Icon size={16} />CLOUDBOX · {document.short.toUpperCase()}</span><h2>{kind === 'terms' ? <>Un espacio compartido.<br /><span>Reglas claras para todos.</span></> : kind === 'privacy' ? <>Tu información importa.<br /><span>Conoce cómo la tratamos.</span></> : <>Pequeños datos.<br /><span>Una experiencia más clara.</span></>}</h2><p>{intro}</p><div className="legal-metadata"><span><CalendarDays size={14} />Actualizado el 6 de octubre de 2026</span><span><Clock3 size={14} />Lectura aprox. {minutes} min</span></div></div><div className="legal-document-art" aria-hidden="true"><span className="legal-art-orbit" /><span className="legal-art-icon"><Icon size={62} strokeWidth={1.2} /></span><span className="legal-art-caption">Claridad en cada detalle</span></div></section>
    <nav className="legal-documents" aria-label="Documentos legales">{documents.map(({ id, to, short, icon: ItemIcon }) => <NavLink key={id} to={to} className={({ isActive }) => isActive ? 'active' : ''}><ItemIcon size={17} />{short}<ArrowRight size={14} /></NavLink>)}</nav>
    <div className="legal-layout"><aside className="legal-sidebar"><nav className="legal-index" aria-label="Índice del documento"><div><FileText size={16} /><h2>En este documento</h2><span>{sections.length}</span></div><ol>{sections.map((section, index) => <li key={section.title}><a href={`#${kind}-section-${index + 1}`}><span>{String(index + 1).padStart(2, '0')}</span>{cleanTitle(section.title)}</a></li>)}</ol></nav><div className="legal-help"><LifeBuoy size={23} /><h2>¿Necesitas orientación?</h2><p>Consulta las guías de uso de CloudBox en nuestro centro de ayuda.</p><Link to="/soporte">Ir a soporte<ArrowRight size={14} /></Link></div></aside><div className="legal-content"><div className="legal-reading-heading"><span>{document.title}</span><span>{sections.length} apartados</span></div><article className="legal-paper" aria-label={document.title}>{sections.map((section, index) => <section id={`${kind}-section-${index + 1}`} className="legal-section" key={section.title} tabIndex={-1}><header><span>{String(index + 1).padStart(2, '0')}</span><h2>{cleanTitle(section.title)}</h2></header><p>{section.content}</p></section>)}</article><div className="legal-document-footer"><span><Icon size={15} />CloudBox · {document.short}</span><a href="#legal-top">Volver al inicio<ArrowUp size={14} /></a></div></div></div>
  </main><Footer /></div>;
}
