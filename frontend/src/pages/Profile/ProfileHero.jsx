import { Link } from "react-router-dom";
import { ArrowRight, Cloud, ShieldCheck } from "lucide-react";
import UserAvatar from "../../components/UserAvatar/UserAvatar";

export default function ProfileHero({ user }) {
  const name = [user.nombre, user.apellido].filter(Boolean).join(' ') || 'Tu cuenta';
  const state = typeof user.estado === 'string' ? user.estado : user.estado?.nombre;
  return <section className="account-hero" aria-labelledby="account-hero-title"><div className="account-hero-person"><UserAvatar user={{ name, avatarUrl: user.avatarUrl }} className="account-hero-avatar" /><div><span className="account-eyebrow"><Cloud size={14} />TU CUENTA EN CLOUDBOX</span><h2 id="account-hero-title">{name}</h2><p>{user.correo}</p><div className="account-hero-tags">{user.rol && <span>{user.rol}</span>}{state && <span>{state}</span>}</div></div></div><div className="account-hero-side"><span><ShieldCheck size={24} /></span><div><strong>Tu espacio, a tu manera.</strong><p>Cuida tus datos y haz que CloudBox se sienta como tú.</p><Link to="/perfil?tab=seguridad">Revisar seguridad<ArrowRight size={14} /></Link></div></div></section>;
}
