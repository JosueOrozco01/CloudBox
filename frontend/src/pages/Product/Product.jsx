import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, Cloud, FolderOpen, Share2, ShieldCheck, Heart, Users, KeyRound, History, Trash2, HardDrive, Bell, Star } from 'lucide-react';
import Topbar from '../../components/TopBarPrincipal/Topbarprincipal';
import Footer from '../../components/FooterSignOut/Footer';
import './Product.css';

const content = {
  about: {
    label: 'SOBRE NOSOTROS', title: 'Menos desorden.', accent: 'Más espacio para tus ideas.',
    intro: 'CloudBox reúne tus archivos, tus proyectos y las personas con las que los compartes. Un espacio sencillo para continuar lo que estás creando.', icon: Cloud,
    heading: 'Creemos en lo simple', description: 'Guardar un archivo debería ser el comienzo de algo, no una tarea más en tu día.',
    cards: [[FolderOpen, 'Un lugar para lo tuyo', 'Documentos, imágenes y proyectos organizados en un mismo espacio.'], [Users, 'Hecho para compartir', 'Acerca tus archivos a otras personas y elige cómo pueden utilizarlos.'], [Heart, 'Claridad en cada paso', 'Tu almacenamiento, tu actividad y tu suscripción, con información a mano.']],
    steps: [['01', 'Guarda lo que importa', 'Crea tu cuenta y organiza tus primeros archivos.'], ['02', 'Dale tu propio orden', 'Usa carpetas y favoritos para encontrar lo que necesitas.'], ['03', 'Sigue creando', 'Comparte recursos y consulta lo que ocurre en tu espacio.']],
    callout: 'Tu próximo proyecto merece su propio espacio.', cta: 'Conoce nuestros planes', to: '/planes'
  },
  features: {
    label: 'CARACTERÍSTICAS', title: 'Todo lo que guardas.', accent: 'Más cerca de ti.',
    intro: 'Del primer documento a tu siguiente proyecto: organiza, encuentra y comparte tus archivos desde una interfaz pensada para tu día a día.', icon: FolderOpen,
    heading: 'Tu espacio, con más posibilidades', description: 'Herramientas conectadas para que cada archivo tenga su lugar.',
    cards: [[FolderOpen, 'Archivos en orden', 'Organiza tus documentos en carpetas, busca por nombre y elige cómo verlos.'], [Share2, 'Comparte a tu manera', 'Envía archivos y carpetas a otros usuarios y administra sus permisos.'], [Star, 'Tus favoritos, a mano', 'Destaca los recursos que consultas con más frecuencia.'], [History, 'Tu actividad en contexto', 'Consulta las acciones registradas y filtra tu historial.'], [Trash2, 'Una segunda oportunidad', 'Revisa tu papelera para restaurar elementos o eliminarlos permanentemente.'], [Bell, 'Novedades en tu bandeja', 'Revisa tus notificaciones y administra los avisos de tu cuenta.']],
    steps: [['01', 'Organiza', 'Un espacio para tus archivos y carpetas.'], ['02', 'Colabora', 'Recursos compartidos con permisos claros.'], ['03', 'Administra', 'Consulta consumo, planes y pagos en tu cuenta.']],
    callout: 'Haz espacio para lo que viene.', cta: 'Explorar planes', to: '/planes'
  },
  security: {
    label: 'SEGURIDAD', title: 'Tu espacio personal.', accent: 'El control en tus manos.',
    intro: 'Conoce las herramientas de tu cuenta para administrar accesos, revisar tu actividad y compartir tus archivos con permisos definidos.', icon: ShieldCheck,
    heading: 'Pequeñas acciones. Más control.', description: 'Estas son las opciones que puedes consultar y administrar en CloudBox.',
    cards: [[KeyRound, 'Acceso a tu cuenta', 'Actualiza tu contraseña desde la sección de seguridad de tu perfil.'], [Users, 'Sesiones de tu cuenta', 'Consulta las sesiones registradas y cierra las que ya no necesitas.'], [Share2, 'Permisos al compartir', 'Elige el acceso de cada destinatario y revisa tus recursos compartidos.'], [History, 'Actividad visible', 'Consulta el historial de acciones registradas en tu cuenta.'], [Trash2, 'Eliminación con cuidado', 'Revisa los elementos en papelera antes de eliminarlos definitivamente.'], [ShieldCheck, 'Información transparente', 'Consulta la política de privacidad para conocer cómo se trata tu información.']],
    steps: [['01', 'Cuida tu contraseña', 'Usa una contraseña única y evita compartir tus credenciales.'], ['02', 'Revisa tus accesos', 'Consulta las sesiones y cierra las que no reconozcas.'], ['03', 'Comparte con intención', 'Verifica el destinatario y el permiso antes de enviar un recurso.']],
    callout: 'Conoce cómo tratamos tu información.', cta: 'Leer política de privacidad', to: '/privacidad'
  }
};

export default function Product({ kind = 'about', embedded = false }) {
  const page = content[kind];
  const Icon = page.icon;
  const account = Boolean(localStorage.getItem('token'));
  return <div className="product-page">{!embedded && <Topbar />}<main className="product-main">
    <section className="product-hero"><div><span className="product-kicker"><Icon size={16} />{page.label}</span><h1>{page.title}<br /><span>{page.accent}</span></h1><p>{page.intro}</p><div className="product-hero-actions"><Link className="product-primary" to={account ? '/archivos' : '/registro'}>{account ? 'Ir a mis archivos' : 'Crear mi cuenta'}<ArrowRight size={16} /></Link><Link to={page.to}>{page.cta}<ArrowRight size={15} /></Link></div></div><div className="product-art" aria-hidden="true"><div className="product-orbit" /><div className="product-art-center"><Icon size={72} strokeWidth={1.2} /></div><span className="product-art-chip"><Cloud size={16} />Tu espacio en CloudBox</span><span className="product-art-small"><HardDrive size={22} /></span></div></section>
    <nav className="product-nav" aria-label="Conoce CloudBox"><NavLink to="/sobre-nosotros">Sobre nosotros</NavLink><NavLink to="/caracteristicas">Características</NavLink><NavLink to="/seguridad">Seguridad</NavLink><NavLink to="/planes">Planes<ArrowRight size={14} /></NavLink></nav>
    <section className="product-section"><div className="product-section-title"><span className="product-eyebrow">PENSADO PARA TU DÍA A DÍA</span><h2>{page.heading}</h2><p>{page.description}</p></div><div className="product-cards">{page.cards.map(([CardIcon, title, description], index) => <article className="product-card" key={title}><div className="product-card-top"><span><CardIcon size={23} strokeWidth={1.6} /></span><small>{String(index + 1).padStart(2, '0')}</small></div><h3>{title}</h3><p>{description}</p>{kind === 'security' && index === 5 && <Link to="/privacidad">Leer política<ArrowRight size={14} /></Link>}</article>)}</div></section>
    <section className="product-guide"><div className="product-section-title"><span className="product-eyebrow">A TU RITMO</span><h2>{kind === 'security' ? 'Buenos hábitos para tu cuenta' : 'De la idea a tu espacio'}</h2></div><div className="product-steps">{page.steps.map(([number, title, description]) => <div key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></div>)}</div></section>
    <section className="product-cta"><div><span className="product-eyebrow">SIGAMOS CONECTADOS</span><h2>{page.callout}</h2><p>Encuentra tu siguiente paso en CloudBox.</p></div><Link className="product-primary" to={page.to}>{page.cta}<ArrowRight size={16} /></Link></section>
  </main><Footer /></div>;
}
