import { useEffect, useEffectEvent, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react';
import { getTourSteps } from './guideContent';
import { positionTourCard, spotlightBounds } from './tourGeometry';

function findTarget(selectors) {
  for (const selector of selectors) {
    const found = [...document.querySelectorAll(selector)].find(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    if (found) return found;
  }
  return null;
}

export default function GuidedTour({ guide, onClose }) {
  const steps = useMemo(() => getTourSteps(guide), [guide]);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState(null);
  const cardRef = useRef(null);
  const titleId = useId(), descriptionId = useId();
  const step = steps[index];
  const last = index === steps.length - 1;
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const previousInert = root?.inert;
    const previousOverflow = document.body.style.overflow;
    const scroll = { left: window.scrollX, top: window.scrollY };
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    cardRef.current?.focus({ preventScroll: true });
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); setIndex(value => Math.min(value + 1, steps.length - 1)); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex(value => Math.max(value - 1, 0)); }
      if (event.key === 'Tab') {
        const buttons = [...cardRef.current.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], end = buttons.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) { event.preventDefault(); end.focus(); }
        else if (!event.shiftKey && (document.activeElement === end || document.activeElement === cardRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      if (root) root.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      window.scrollTo({ ...scroll, behavior: 'instant' });
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [steps.length]);

  useLayoutEffect(() => {
    let frame = 0, currentTarget = null;
    const update = () => {
      const target = findTarget(step.targets);
      if (target && target !== currentTarget) {
        currentTarget = target;
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      }
      const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
      const rect = target?.getBoundingClientRect();
      const spotlight = spotlightBounds(rect, viewport);
      const card = cardRef.current?.getBoundingClientRect() || { height: 300 };
      const position = positionTourCard(spotlight, card, viewport);
      const next = { spotlight, position, viewport };
      setView(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(cardRef.current);
    observer.observe(document.getElementById('root'));
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.getElementById('root'), { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect(); mutations.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [step]);

  const spot = view?.spotlight;
  const position = view?.position;
  const pointer = position && position.side !== 'center' ? {
    left: position.side === 'right' ? position.left - 6 : position.side === 'left' ? position.left + position.width - 6 : position.left + position.arrow - 6,
    top: position.side === 'bottom' ? position.top - 6 : position.side === 'top' ? position.top + position.height - 6 : position.top + position.arrow - 6,
  } : null;
  const panels = spot ? [
    { top: 0, left: 0, right: 0, height: spot.top },
    { top: spot.bottom, bottom: 0, left: 0, right: 0 },
    { top: spot.top, left: 0, width: spot.left, height: spot.height },
    { top: spot.top, left: spot.right, right: 0, height: spot.height },
  ] : [{ inset: 0 }];

  return createPortal(<div className="tour-overlay">
    <div className="tour-shield" aria-hidden="true" />
    {panels.map((style, panel) => <div className="tour-veil" style={style} key={panel} aria-hidden="true" />)}
    {spot && <div className="tour-spotlight" style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height }} aria-hidden="true"><span /></div>}
    {pointer && <span className="tour-arrow" style={pointer} aria-hidden="true" />}
    <section ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} data-placement={position?.side || 'center'} style={position ? { left: position.left, top: position.top, width: position.width, '--tour-arrow-offset': `${position.arrow}px` } : undefined}>
      <div className="tour-card-top"><span className="tour-badge"><Sparkles size={17} />UN PEQUEÑO RECORRIDO</span><button type="button" className="tour-close" aria-label="Cerrar guía" onClick={onClose}><X size={18} /></button></div>
      <div className="tour-step-meta"><span>{guide.title}</span><span>Paso {index + 1} de {steps.length}</span></div>
      <div className="tour-copy" aria-live="polite" aria-atomic="true"><h2 id={titleId}>{step.title}</h2><p id={descriptionId}>{step.text}</p></div>
      <div className="tour-progress" role="progressbar" aria-label="Progreso de la guía" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
      <div className="tour-footer"><button type="button" className="tour-skip" onClick={onClose}>Omitir</button><div className="tour-controls"><button type="button" className="tour-back" disabled={index === 0} onClick={() => setIndex(value => value - 1)} aria-label="Paso anterior"><ArrowLeft size={17} /><span>Anterior</span></button><button type="button" className="tour-next" onClick={() => last ? onClose() : setIndex(value => value + 1)}>{last ? 'Finalizar' : 'Siguiente'}{last ? <Check size={17} /> : <ArrowRight size={17} />}</button></div></div>
      <span className="tour-keyboard-hint">A tu ritmo. También puedes usar las flechas del teclado.</span>
    </section>
  </div>, document.body);
}
