import { useEffect, useState } from 'react';
import { api, query } from '../services/apiClient';

export function useAdminNotificationRead(userId, offset = 0, limit = 100) {
  const [read, setRead] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active=true, pending=false;
    const refresh=async()=>{
      if(pending || document.hidden)return;
      pending=true;
      try {
        const key=`cloudbox:notifications:read:${userId}`;
        let legacy=[];
        try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))legacy=[...new Set(saved.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))].slice(-1000);}catch{ /* Ignore invalid legacy browser state. */ }
        for(let start=0;start<legacy.length;start+=200)await api('/admin/notification-reads',{method:'PATCH',body:{ids:legacy.slice(start,start+200)}});
        if(legacy.length)try{localStorage.removeItem(key);}catch{ /* Persisted reads are already stored remotely. */ }
        const result=await api(`/admin/notification-reads?${query({offset,limit})}`); if(active){setRead(current=>[...new Set([...current,...result.data])]);setError('');} }
      catch(error){if(active)setError(error.message);}
      finally{pending=false;}
    };
    refresh();
    const interval=setInterval(refresh,5000);
    window.addEventListener('admin-notifications-read',refresh);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{active=false;clearInterval(interval);window.removeEventListener('admin-notifications-read',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[userId,offset,limit]);
  const markRead=async ids=>{
    try { await api('/admin/notification-reads',{method:'PATCH',body:{ids}});setRead(current=>[...new Set([...current,...ids])]);setError('');window.dispatchEvent(new Event('admin-notifications-read'));return true; }
    catch(error){setError(error.message);return false;}
  };
  return {read,markRead,error};
}
