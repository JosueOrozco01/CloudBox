import Topbar from "../../components/TopBarPrincipal/Topbarprincipal";
import { money, date } from '../../utils/moduleFormat';
import { useResource } from '../../hooks/useResource';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, ChevronDown, CalendarDays, Check, Cloud, CreditCard, HardDrive, History, ShieldCheck, Sparkles } from 'lucide-react';
import { getPlans } from '../../services/planService';
import { getSubscription, getSubscriptionHistory, getQuota, subscriptionAction } from '../../services/subscriptionService';
import { getPaymentMethods } from '../../services/paymentService';
import { ModulePage, Panel, Table, Badge, Feedback, Empty, Refresh, Modal } from '../../components/ModuleUI/ModuleUI';
import PlanOverview from './PlanOverview';
import './Plans.css';

export default function Plans({
  publicCatalog = false, embedded = false
}) {
  const navigate = useNavigate();
  const resource = useResource(async () => {
    if (publicCatalog) return { plans: await getPlans() };
    const [plans, results] = await Promise.all([
      getPlans(),
      Promise.allSettled([getSubscription(), getSubscriptionHistory(), getQuota(), getPaymentMethods()]),
    ]);
    const [current, history, quota, methods] = results.map(r => r.status === 'fulfilled' ? r.value : null);
    return {
      plans,
      current,
      currentLoaded: results[0].status === 'fulfilled',
      history,
      quota,
      methods,
      warnings: results.filter(r => r.status === 'rejected').map(r => r.reason.message)
    };
  }, [publicCatalog]);
  const [action, setAction] = useState(null);
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [declined, setDeclined] = useState(false);
  const data = resource.data;
  const start = (type, plan) => {
    if (publicCatalog) {
      navigate(localStorage.getItem('token') ? '/plan' : '/registro');
      return;
    }
    setAction({
      type,
      plan
    });
    setMethod('');
    setReference(`CB-${crypto.randomUUID()}`);
    setFailure(false);
    setError('');
    setDeclined(false);
  };
  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await subscriptionAction(action.type, action.type === 'cancel' ? undefined : {
        ...(action.type === 'subscribe' ? {
          planId: action.plan.id
        } : {}),
        ...(action.type === 'change-plan' ? {
          newPlanId: action.plan.id
        } : {}),
        paymentMethodId: Number(method),
        referenceCode: reference,
        simulateFailure: failure
      });
      const details = [result.scheduled ? `Operación programada para el ${date(result.effectiveOn)}.` : 'Operación completada.', ...[['creditGenerated', 'Crédito generado'], ['creditApplied', 'Crédito aplicado'], ['remainingCredit', 'Crédito restante'], ['amountDue', 'Importe de la operación']].filter(([key]) => result[key] != null).map(([key, label]) => `${label}: ${money(result[key])}.`)];
      setMessage(details.join(' '));
      setAction(null);
      resource.refresh();
      window.dispatchEvent(new Event('storage-changed'));
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (err) {
      setDeclined(err.status === 402);
      setError(`${err.message}${err.status >= 500 ? ' Consulta el historial antes de reintentar; conserva esta referencia.' : ''}`);
    } finally {
      setBusy(false);
    }
  };
  return <>{publicCatalog && !embedded && <Topbar />}<ModulePage loading={resource.loading} title={publicCatalog ? 'Un plan para cada espacio' : 'Mi plan'} description={publicCatalog ? 'Elige el espacio que necesitas para guardar y compartir tus archivos.' : 'Consulta tu almacenamiento y administra tu suscripción.'} actions={<><Refresh onClick={resource.refresh} busy={resource.loading} />{publicCatalog && <Link className="module-button" to={localStorage.getItem('token') ? '/dashboard' : '/'}>Volver a inicio</Link>}</>}>
    <Feedback error={resource.error} message={message} />
    {publicCatalog && <section className="plans-public-hero"><div><span className="plans-kicker"><Cloud size={15} />TU ESPACIO EMPIEZA AQUÍ</span><h2>Grandes ideas.<br /><span>El espacio que necesitan.</span></h2><p>Empieza con lo esencial o amplía tu capacidad. Encuentra el plan que acompaña tus archivos y tus próximos proyectos.</p><a className="module-button plans-hero-button" href="#plans-catalog">Explorar planes<ArrowRight size={16} /></a><div className="plans-public-benefits"><span><Check size={14} />Archivos organizados</span><span><Check size={14} />Permisos al compartir</span><span><Check size={14} />Acceso desde la web</span></div></div><div className="plans-public-art" aria-hidden="true"><div><Cloud size={70} strokeWidth={1.3} /></div><span><HardDrive size={15} />Más espacio. Más posibilidades.</span></div></section>}
    
    {data?.warnings?.length > 0 && <Feedback error={[...new Set(data.warnings)].join(' ')} />}
    {!publicCatalog && data && <PlanOverview data={data} />}
    {data && <div id="plans-catalog" className="plans-section-heading"><div><span className="plans-kicker"><Sparkles size={14} />ESPACIO PARA LO QUE SIGUE</span><h2>{publicCatalog ? 'Elige el espacio que va contigo' : 'Un plan que crece contigo'}</h2><p>Compara las opciones y encuentra tu próximo espacio.</p></div><span className="plans-catalog-note"><ShieldCheck size={15} />Tú eliges cómo continuar</span></div>}
    <div className="plans-catalog">{data?.plans?.map((plan, index) => {
      const selected = data.current?.planId === plan.id;
      const Icon = plan.precio === 0 ? Cloud : index === data.plans.length - 1 ? Sparkles : HardDrive;
      return <article className={`plans-option ${publicCatalog && index === 1 ? 'highlighted' : ''} ${selected ? 'selected' : ''}`} key={plan.id}>
        {publicCatalog && index === 1 && <span className="plans-option-banner"><Sparkles size={13} />Un siguiente paso para tus proyectos</span>}
        <div className="plans-option-top"><span className={`plans-option-icon ${plan.precio === 0 ? 'free' : ''}`}><Icon size={23} strokeWidth={1.7} /></span>{selected ? <Badge>Tu plan</Badge> : <span className="plans-option-label">{plan.precio === 0 ? 'Para empezar' : 'Más posibilidades'}</span>}</div>
        <h2>{plan.nombre}</h2><p className="plans-option-description">{plan.descripcion || (plan.precio === 0 ? 'Un lugar para empezar a guardar lo tuyo.' : 'Dale más espacio a tus archivos y proyectos.')}</p>
        <div className="plans-option-price"><strong>{money(plan.precio)}</strong><span>{plan.precio === 0 ? 'sin costo' : `por ${plan.vigencia_dias} días`}</span></div>
        <div className="plans-option-capacity"><HardDrive size={17} /><strong>{plan.espacio_maximo_gb} GB</strong><span>de almacenamiento</span></div>
        <ul><li><Check size={15} />{plan.precio === 0 ? 'Sin vencimiento comercial' : `${plan.vigencia_dias} días de vigencia`}</li><li><Check size={15} />Organiza y comparte tus archivos</li><li><Check size={15} />Accede a tu espacio desde la web</li></ul>
        <div className="plans-option-action">{publicCatalog ? <button className="module-button primary" onClick={() => start('subscribe', plan)}>Elegir plan</button> : plan.precio > 0 ? <button className={`module-button ${selected ? '' : 'primary'}`} disabled={busy || !data.methods?.length || !data.currentLoaded} onClick={() => start(selected ? 'renew' : data.current?.price > 0 ? 'change-plan' : 'subscribe', plan)}>{selected ? 'Renovar plan' : 'Elegir plan'}</button> : <span className="plans-free-note"><Check size={15} />{selected ? 'Incluido con tu cuenta' : 'Disponible al finalizar tu plan pagado'}</span>}</div>
      </article>;
    })}</div>
    {data && !data.plans.length && <Empty>No hay planes disponibles.</Empty>}
    {!publicCatalog && data && <><section className="plans-management" aria-labelledby="plans-management-title"><div className="plans-management-intro"><span className="plans-management-icon"><CalendarDays size={21} /></span><div><h2 id="plans-management-title">Tu suscripción, a tu ritmo</h2><p>Las mejoras pueden aplicar crédito proporcional. Los cambios a un plan menor y la cancelación se programan al finalizar la vigencia.</p></div></div><div className="plans-management-actions"><Link className="module-button" to="/pagos"><CreditCard size={15} />Ver pagos y comprobantes</Link><button className="plans-cancel" disabled={busy || !data.current || data.current.price === 0} onClick={() => start('cancel')}>Cancelar suscripción</button></div></section><div className="plans-history-heading"><History size={18} /><h2>Tu recorrido en CloudBox</h2><span>Historial de suscripciones</span></div><Panel title="Historial de suscripciones"><Table rows={data.history} columns={[{
          label: 'Plan',
          key: 'planName'
        }, {
          label: 'Estado',
          render: r => <Badge>{r.status}</Badge>
        }, {
          label: 'Inicio',
          render: r => date(r.startDate)
        }, {
          label: 'Fin',
          render: r => r.price === 0 ? 'Sin vencimiento' : date(r.endDate)
        }, {
          label: 'Monto registrado',
          render: r => r.price == null ? 'No disponible' : money(r.price)
        }]} /></Panel></>}
    {publicCatalog && <><section className="plans-public-included"><div><ShieldCheck size={24} /><h2>Lo esencial va contigo</h2><p>Todos los planes te permiten organizar tus archivos, compartir recursos y consultar tu actividad. La capacidad y la vigencia de cada opción se muestran en su tarjeta.</p></div><Link to="/caracteristicas">Conocer las características<ArrowRight size={15} /></Link></section><section className="plans-public-faq"><div><span className="plans-kicker">ANTES DE ELEGIR</span><h2>Tu espacio, sin dudas</h2><p>Algunas respuestas para encontrar tu siguiente plan.</p></div><div>{[['¿Cómo empiezo?', 'Crea tu cuenta y entra a Mi plan para consultar tu suscripción y las opciones disponibles.'], ['¿Puedo cambiar de plan?', 'Puedes elegir otro plan desde tu cuenta. Las mejoras pueden aplicar crédito proporcional; los cambios a un plan menor se programan al finalizar la vigencia.'], ['¿Qué pasa si cancelo mi suscripción?', 'Conservas el servicio pagado hasta el final de la vigencia y después regresas al plan Free. Si excedes su cuota, las nuevas subidas quedan bloqueadas.'], ['¿Dónde consulto mis pagos?', 'En la sección Pagos de tu cuenta puedes revisar las operaciones registradas y consultar sus comprobantes.']].map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={16} /></summary><p>{answer}</p></details>)}</div></section></>}
    {action && <Modal title={action.type === 'cancel' ? 'Cancelar suscripción' : `${action.type === 'renew' ? 'Renovar' : 'Elegir'} ${action.plan.nombre}`} onClose={() => setAction(null)} busy={busy}><form className="module-form" onSubmit={submit}><Feedback error={error} />{declined && <button type="button" className="module-button" onClick={() => {
          setReference(`CB-${crypto.randomUUID()}`);
          setDeclined(false);
          setFailure(false);
          setError('');
        }}>Preparar un nuevo intento</button>}{action.type === 'cancel' ? <p className="module-muted">Conservarás el servicio pagado hasta el final de su vigencia. Después regresarás al plan Free. Tus archivos se conservan; si excedes su cuota, las subidas quedarán bloqueadas.</p> : <><p className="module-muted">Pago simulado. Precio del plan: {money(action.plan.precio)} por {action.plan.vigencia_dias} días. El crédito y la fecha efectiva se calculan según tu suscripción.</p><label className="module-field">Método de pago<select required disabled={busy} value={method} onChange={e => setMethod(e.target.value)}><option value="">Selecciona un método</option>{data.methods?.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label><label className="module-field">Referencia de la operación<input required minLength={8} pattern="[A-Za-z0-9][A-Za-z0-9_-]{7,99}" maxLength={100} disabled={busy} value={reference} onChange={e => setReference(e.target.value)} /></label><label className="module-muted"><input type="checkbox" checked={failure} disabled={busy} onChange={e => setFailure(e.target.checked)} /> Simular pago rechazado</label></>}<div className="module-actions"><button type="button" className="module-button" disabled={busy} onClick={() => setAction(null)}>Volver</button><button className="module-button primary" disabled={busy || declined}>{busy ? 'Procesando…' : 'Confirmar operación'}</button></div></form></Modal>}
  </ModulePage></>;
}
