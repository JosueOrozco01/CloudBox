import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import GuidedTour from './GuidedTour';
import { getPageGuide } from './guideContent';
import './PageGuide.css';

function GuideButton({ guide }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="page-guide-button" onClick={() => { if (!document.querySelector('.loading-page, .loading-overlay')) setOpen(true); }} aria-haspopup="dialog"><CircleHelp size={20} /><span>Guía de esta pestaña</span></button>
    {open && <GuidedTour guide={guide} onClose={() => setOpen(false)} />}
  </>;
}

export default function PageGuide() {
  const { pathname, search } = useLocation();
  return <GuideButton key={pathname + search} guide={getPageGuide(pathname, search)} />;
}
