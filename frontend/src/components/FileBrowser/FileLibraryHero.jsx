import { Link } from "react-router-dom";
import { ArrowRight, Cloud, HardDrive, Upload } from "lucide-react";

const space = value => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  const [size, unit] = amount === 0 || amount >= 1 ? [amount, 'GB'] : amount * 1024 >= 1 ? [amount * 1024, 'MB'] : [amount * 1024 ** 2, 'KB'];
  return `${size.toLocaleString('es-GT', { maximumFractionDigits: 2 })} ${unit}`;
};

export default function FileLibraryHero({ storage, onUpload }) {
  const percentage = Math.max(0, Number(storage?.percentageUsed) || 0);
  return <section className="mf-library-hero" aria-labelledby="mf-library-hero-title"><div className="mf-library-hero-copy"><span className="mf-library-eyebrow"><Cloud size={16} />TU ESPACIO PERSONAL</span><h2 id="mf-library-hero-title">Tus archivos. Tus ideas.<br /><span>Todo en su lugar.</span></h2><p>Un lugar para guardar lo que importa y darle espacio a lo que viene.</p><button type="button" className="mf-library-hero-upload" onClick={onUpload}><Upload size={16} />Añadir a mi espacio<ArrowRight size={15} /></button></div>{storage ? <div className="mf-library-storage"><div className="mf-library-storage-top"><HardDrive size={19} /><span>El espacio de tu plan</span></div><div className="mf-library-storage-amount"><strong>{space(storage.usedGB)}</strong><span>de {space(storage.totalGB)} utilizados</span></div><div className={`mf-library-storage-track ${percentage >= 90 ? 'warning' : ''}`} role="progressbar" aria-label="Almacenamiento utilizado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percentage)}><span style={{ width: `${Math.min(100, percentage)}%` }} /></div><div className="mf-library-storage-bottom"><span>{space(storage.availableGB)} disponibles</span><Link to="/plan">Ver mi plan<ArrowRight size={13} /></Link></div></div> : <div className="mf-library-hero-cloud" aria-hidden="true"><Cloud size={110} strokeWidth={1} /><span>Un lugar para lo tuyo</span></div>}</section>;
}
