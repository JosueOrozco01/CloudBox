import { useEffect, useRef, useState } from "react";
import "./Offline.css";

export default function OfflineBanner() {
  const [status, setStatus] = useState(navigator.onLine ? null : "offline");
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    const handleOffline = () => {
      clearTimers();
      setStatus("offline");
    };

    const handleOnline = () => {
      clearTimers();
      setStatus("connecting");

      const t1 = setTimeout(() => setStatus("online"), 3000);

      const t2 = setTimeout(() => setStatus(null), 5000);

      timers.current.push(t1, t2);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      clearTimers();
    };
  }, []);

  if (!status) return null;

  const content = {
    offline: {
      className: "offline",
      text: "Sin conexión a internet",
      icon: (
        <path d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.17-2.69M19 12.9a10 10 0 0 0-2.007-1.523M2 8.82a15 15 0 0 1 4.177-2.643M22 8.82a15 15 0 0 0-11.288-3.764m-8.712-3.056 20 20" />
      ),
    },
    connecting: {
      className: "connecting",
      text: "Conectando...",
      icon: (
        <path d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 14 0" />
      ),
    },
    online: {
      className: "online",
      text: "Conectado a internet",
      icon: (
        <path d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 14 0" />
      ),
    },
  }[status];

  return (
    <div className={`offline-banner ${content.className}`} role="status">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {content.icon}
      </svg>
      {content.text}
    </div>
  );
}